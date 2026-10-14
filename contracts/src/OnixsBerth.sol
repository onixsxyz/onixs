// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOnixsMorpho, OnixsMarketParams, OnixsMarketState} from "./interfaces/IOnixsMorpho.sol";
import {IOnixsFeed, IOnixsSwapPool} from "./interfaces/IOnixsExternal.sol";
import {IOnixsCharter, OnixsListing} from "./interfaces/IOnixsCharter.sol";
import {OnixsAccrual} from "./OnixsAccrual.sol";

interface IOnixsMarkPrice {
    function stockUsd() external view returns (uint256);
    function usdgUsd() external view returns (uint256);
    function price() external view returns (uint256);
}

/// @title OnixsBerth
/// @notice One account per wallet, created by OnixsCharter as a minimal proxy. It holds that wallet's Morpho Blue
///         positions in its own name, so the wallet never grants Morpho-wide authorization to anyone. Only the
///         owner can act. Between transactions it holds nothing of value except those Morpho positions.
///         - Short: borrow a stock against USDG and sell it in the same transaction.
///         - Long: buy a stock with the owner's USDG plus a USDG loan, lend it in its leasehold, post the shares.
///         - Pair: one long and one short in one transaction.
///         Opens check the listing (not paused, feed fresh, fill near the feed price). Closes check none of that,
///         so they work over weekends and while a listing is paused. ownerCall lets the owner reach Morpho
///         directly (repay, withdraw collateral) without any ONIXS logic in the way.
contract OnixsBerth {
    using SafeERC20 for IERC20;

    error OnixsBerthNotOwner();
    error OnixsBerthBusy();
    error OnixsBerthBadCaller();
    error OnixsBerthAlreadySet();
    error OnixsBerthPaused();
    error OnixsBerthStaleFeed();
    error OnixsBerthLeverage();
    error OnixsBerthFill();
    error OnixsBerthMinOut();
    error OnixsBerthMaxIn();
    error OnixsBerthPartialFill();
    error OnixsBerthOpenLimit();
    error OnixsBerthNothingOpen();
    error OnixsBerthLeaseholdBusy();
    error OnixsBerthForbiddenTarget();

    struct PairOpen {
        uint256 longId;
        uint256 longMargin;
        uint256 loan;
        uint256 minStockOut;
        uint256 shortId;
        uint256 shortMargin;
        uint256 stockAmount;
        uint256 minUsdgOut;
    }

    uint8 private constant IDLE = 0;
    uint8 private constant OPEN_SHORT = 1;
    uint8 private constant CLOSE_SHORT = 2;
    uint8 private constant OPEN_LONG = 3;
    uint8 private constant CLOSE_LONG = 4;

    uint160 private constant MIN_SQRT_RATIO_PLUS_ONE = 4295128740;
    uint160 private constant MAX_SQRT_RATIO_MINUS_ONE = 1461446703485210103287273052203988822378723970341;

    IOnixsMorpho public immutable morpho;
    address public immutable usdg;
    address public immutable charter;
    uint256 private immutable usdgTo18;

    address public owner;
    bool private entered;
    uint8 private phase;
    address private swapPool;
    uint256 private carryA;
    uint256 private carryB;

    constructor(address morpho_, address usdg_) {
        morpho = IOnixsMorpho(morpho_);
        usdg = usdg_;
        charter = msg.sender;
        usdgTo18 = 10 ** (18 - IERC20Metadata(usdg_).decimals());
        owner = address(1); // the implementation itself can never be used
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnixsBerthNotOwner();
        if (entered) revert OnixsBerthBusy();
        entered = true;
        _;
        entered = false;
    }

    /// @notice Called once by the charter right after the minimal proxy is created.
    function initialize(address owner_) external {
        if (msg.sender != charter) revert OnixsBerthBadCaller();
        if (owner != address(0)) revert OnixsBerthAlreadySet();
        owner = owner_;
    }

    receive() external payable {}

    // ------------------------------------------------------------------ shorts

    /// @notice Borrow `stockAmount` of the listing's stock against `margin` USDG and sell it for at least `minUsdgOut`.
    ///         The margin and the sale both stay posted as collateral.
    function openShort(uint256 id, uint256 margin, uint256 stockAmount, uint256 minUsdgOut) external onlyOwner {
        OnixsListing memory l = _openable(id);
        _pull(margin);
        _openShort(id, l, margin, stockAmount, minUsdgOut);
    }

    /// @notice Buy back what is owed, repay it, and send the rest of the collateral to the owner.
    ///         `maxUsdgIn` caps the buy-back; if the collateral is short, the gap is pulled from the owner.
    function closeShort(uint256 id, uint256 maxUsdgIn) external onlyOwner {
        _closeShort(id, _listing(id), maxUsdgIn);
        _payOwner();
    }

    // ------------------------------------------------------------------ leveraged longs

    /// @notice Buy the stock with `margin` USDG plus a `loan` of USDG, lend it in the leasehold and post the shares.
    function openLong(uint256 id, uint256 margin, uint256 loan, uint256 minStockOut) external onlyOwner {
        OnixsListing memory l = _openable(id);
        _pull(margin);
        _openLong(id, l, margin, loan, minStockOut);
    }

    /// @notice Repay the loan, take the shares back, redeem and sell the stock; at least `minUsdgOut` reaches the owner.
    function closeLong(uint256 id, uint256 minUsdgOut) external onlyOwner {
        _closeLong(id, _listing(id));
        if (_payOwner() < minUsdgOut) revert OnixsBerthMinOut();
    }

    // ------------------------------------------------------------------ pairs

    function openPair(PairOpen calldata p) external onlyOwner {
        OnixsListing memory lg = _openable(p.longId);
        OnixsListing memory sh = _openable(p.shortId);
        _pull(p.longMargin + p.shortMargin);
        _openLong(p.longId, lg, p.longMargin, p.loan, p.minStockOut);
        _openShort(p.shortId, sh, p.shortMargin, p.stockAmount, p.minUsdgOut);
    }

    function closePair(uint256 longId, uint256 shortId, uint256 maxUsdgIn, uint256 minUsdgOut) external onlyOwner {
        _closeLong(longId, _listing(longId));
        _closeShort(shortId, _listing(shortId), maxUsdgIn);
        if (_payOwner() < minUsdgOut) revert OnixsBerthMinOut();
    }

    // ------------------------------------------------------------------ owner escape hatches

    /// @notice Any call in the berth's name (for example repaying or withdrawing on Morpho directly).
    function ownerCall(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        if (target == charter) revert OnixsBerthForbiddenTarget();
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        return ret;
    }

    function sweep(address token, address to) external onlyOwner {
        if (token == address(0)) {
            (bool ok,) = to.call{value: address(this).balance}("");
            if (!ok) revert OnixsBerthBadCaller();
        } else {
            IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
        }
    }

    // ------------------------------------------------------------------ views

    /// @notice Stock owed and USDG posted on a listing's short market, interest included to this block.
    function shortOf(uint256 id) external view returns (uint256 debtStock, uint256 collateralUsdg) {
        return _positionOf(_listing(id).shortMarket);
    }

    /// @notice USDG owed and leasehold shares posted on a listing's credit market, interest included to this block.
    function longOf(uint256 id) external view returns (uint256 debtUsdg, uint256 collateralShares) {
        return _positionOf(_listing(id).creditMarket);
    }

    function _positionOf(OnixsMarketParams memory p) internal view returns (uint256 debt, uint256 collateral) {
        (, uint128 bs, uint128 col) = morpho.position(OnixsAccrual.id(p), address(this));
        OnixsMarketState memory m = OnixsAccrual.accrued(morpho, p);
        debt = OnixsAccrual.toAssetsUp(bs, m.totalBorrowAssets, m.totalBorrowShares);
        collateral = col;
    }

    // ------------------------------------------------------------------ internals: shorts

    function _openShort(uint256 id, OnixsListing memory l, uint256 margin, uint256 stockAmount, uint256 minUsdgOut) internal {
        uint256 upfront = margin + minUsdgOut;
        IERC20(usdg).forceApprove(address(morpho), upfront);
        phase = OPEN_SHORT;
        morpho.supplyCollateral(l.shortMarket, upfront, address(this), abi.encode(l, stockAmount, minUsdgOut));
        phase = IDLE;
        uint256 sold = carryA;
        carryA = 0;

        uint256 extra = sold - minUsdgOut;
        if (extra != 0) {
            IERC20(usdg).forceApprove(address(morpho), extra);
            morpho.supplyCollateral(l.shortMarket, extra, address(this), "");
        }

        (, uint128 bs, uint128 col) = morpho.position(OnixsAccrual.id(l.shortMarket), address(this));
        OnixsMarketState memory m = OnixsAccrual.stateOf(morpho, OnixsAccrual.id(l.shortMarket));
        uint256 debt = OnixsAccrual.toAssetsUp(bs, m.totalBorrowAssets, m.totalBorrowShares);
        uint256 room = Math.mulDiv(col, IOnixsMarkPrice(l.shortMarket.oracle).price(), 1e36);
        if (debt * 10000 > room * l.shortOpenLtvBps) revert OnixsBerthOpenLimit();

        IOnixsCharter(charter).record(1, id, margin, stockAmount, sold, 0);
    }

    function onMorphoSupplyCollateral(uint256, bytes calldata data) external {
        if (msg.sender != address(morpho) || phase != OPEN_SHORT) revert OnixsBerthBadCaller();
        (OnixsListing memory l, uint256 stockAmount, uint256 minUsdgOut) = abi.decode(data, (OnixsListing, uint256, uint256));
        morpho.borrow(l.shortMarket, stockAmount, 0, address(this), address(this));
        uint256 out = _swapExactIn(l.pool, l.stock, stockAmount);
        if (out < minUsdgOut) revert OnixsBerthMinOut();
        _checkFill(l, stockAmount, out, true);
        carryA = out;
    }

    function _closeShort(uint256 id, OnixsListing memory l, uint256 maxUsdgIn) internal {
        (, uint128 bs, uint128 col) = morpho.position(OnixsAccrual.id(l.shortMarket), address(this));
        if (bs == 0 && col == 0) revert OnixsBerthNothingOpen();
        uint256 repaid;
        uint256 spent;
        if (bs == 0) {
            morpho.withdrawCollateral(l.shortMarket, col, address(this), address(this));
        } else {
            phase = CLOSE_SHORT;
            (repaid,) = morpho.repay(l.shortMarket, 0, bs, address(this), abi.encode(l, uint256(col), maxUsdgIn));
            phase = IDLE;
            spent = carryA;
            carryA = 0;
        }
        IOnixsCharter(charter).record(2, id, repaid, spent, col > spent ? col - spent : 0, 0);
    }

    function onMorphoRepay(uint256 assets, bytes calldata data) external {
        if (msg.sender != address(morpho) || phase != CLOSE_SHORT) revert OnixsBerthBadCaller();
        (OnixsListing memory l, uint256 col, uint256 maxUsdgIn) = abi.decode(data, (OnixsListing, uint256, uint256));
        // The debt is already cleared in Morpho's books at this point, so the collateral can leave.
        morpho.withdrawCollateral(l.shortMarket, col, address(this), address(this));
        carryA = _swapExactOut(l.pool, usdg, assets, maxUsdgIn);
        IERC20(l.stock).forceApprove(address(morpho), assets);
    }

    // ------------------------------------------------------------------ internals: longs

    function _openLong(uint256 id, OnixsListing memory l, uint256 margin, uint256 loan, uint256 minStockOut) internal {
        if (l.maxLeverageBps == 0 || margin == 0 || (margin + loan) * 10000 > margin * l.maxLeverageBps) {
            revert OnixsBerthLeverage();
        }
        phase = OPEN_LONG;
        morpho.flashLoan(usdg, loan, abi.encode(l, margin, minStockOut, uint256(0)));
        phase = IDLE;
        uint256 bought = carryA;
        uint256 shares = carryB;
        carryA = 0;
        carryB = 0;
        IOnixsCharter(charter).record(3, id, margin, loan, bought, shares);
    }

    function _closeLong(uint256 id, OnixsListing memory l) internal {
        bytes32 cid = OnixsAccrual.id(l.creditMarket);
        morpho.accrueInterest(l.creditMarket);
        (, uint128 bs, uint128 col) = morpho.position(cid, address(this));
        if (bs == 0 && col == 0) revert OnixsBerthNothingOpen();
        if (IERC4626(l.leasehold).convertToAssets(col) > _leaseholdAvailable(l.leasehold)) revert OnixsBerthLeaseholdBusy();

        uint256 debt;
        uint256 sold;
        if (bs == 0) {
            morpho.withdrawCollateral(l.creditMarket, col, address(this), address(this));
            uint256 stockOut = IERC4626(l.leasehold).redeem(col, address(this), address(this));
            _swapExactIn(l.pool, l.stock, stockOut);
            sold = stockOut;
        } else {
            OnixsMarketState memory m = OnixsAccrual.stateOf(morpho, cid);
            debt = OnixsAccrual.toAssetsUp(bs, m.totalBorrowAssets, m.totalBorrowShares);
            phase = CLOSE_LONG;
            morpho.flashLoan(usdg, debt, abi.encode(l, uint256(bs), uint256(col), uint256(1)));
            phase = IDLE;
            sold = carryA;
            carryA = 0;
        }
        IOnixsCharter(charter).record(4, id, debt, sold, IERC20(usdg).balanceOf(address(this)), 0);
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        if (msg.sender != address(morpho) || (phase != OPEN_LONG && phase != CLOSE_LONG)) revert OnixsBerthBadCaller();
        if (phase == OPEN_LONG) {
            (OnixsListing memory l, uint256 margin, uint256 minStockOut,) = abi.decode(data, (OnixsListing, uint256, uint256, uint256));
            uint256 spend = margin + assets;
            uint256 stockOut = _swapExactIn(l.pool, usdg, spend);
            if (stockOut < minStockOut) revert OnixsBerthMinOut();
            _checkFill(l, stockOut, spend, false);
            IERC20(l.stock).forceApprove(l.leasehold, stockOut);
            uint256 shares = IERC4626(l.leasehold).deposit(stockOut, address(this));
            IERC20(l.leasehold).forceApprove(address(morpho), shares);
            morpho.supplyCollateral(l.creditMarket, shares, address(this), "");
            morpho.borrow(l.creditMarket, assets, 0, address(this), address(this));
            carryA = stockOut;
            carryB = shares;
        } else {
            (OnixsListing memory l, uint256 bs, uint256 col,) = abi.decode(data, (OnixsListing, uint256, uint256, uint256));
            IERC20(usdg).forceApprove(address(morpho), assets);
            morpho.repay(l.creditMarket, 0, bs, address(this), "");
            morpho.withdrawCollateral(l.creditMarket, col, address(this), address(this));
            uint256 stockOut = IERC4626(l.leasehold).redeem(col, address(this), address(this));
            uint256 usdgOut = _swapExactIn(l.pool, l.stock, stockOut);
            if (usdgOut < assets) revert OnixsBerthMinOut();
            carryA = stockOut;
        }
        // Morpho pulls the flash loan back right after this returns.
        IERC20(usdg).forceApprove(address(morpho), assets);
    }

    // ------------------------------------------------------------------ internals: shared

    function _listing(uint256 id) internal view returns (OnixsListing memory) {
        return IOnixsCharter(charter).getListing(id);
    }

    function _openable(uint256 id) internal view returns (OnixsListing memory l) {
        l = _listing(id);
        if (l.paused) revert OnixsBerthPaused();
        (,,, uint256 updatedAt,) = IOnixsFeed(l.feed).latestRoundData();
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > l.maxFeedAge) revert OnixsBerthStaleFeed();
    }

    function _leaseholdAvailable(address leasehold) internal view returns (uint256) {
        return IOnixsLeaseholdLiquidity(leasehold).available();
    }

    function _pull(uint256 amount) internal {
        if (amount != 0) IERC20(usdg).safeTransferFrom(owner, address(this), amount);
    }

    function _payOwner() internal returns (uint256 amount) {
        amount = IERC20(usdg).balanceOf(address(this));
        if (amount != 0) IERC20(usdg).safeTransfer(owner, amount);
    }

    /// @dev The fill must land within maxSlipBps of the feed: selling gets at least that much USDG for the stock,
    ///      buying gets at least that much stock for the USDG.
    function _checkFill(OnixsListing memory l, uint256 stockAmt, uint256 usdgAmt, bool selling) internal view {
        IOnixsMarkPrice mark = IOnixsMarkPrice(l.shortMarket.oracle);
        uint256 stockValue = Math.mulDiv(stockAmt, mark.stockUsd(), 10 ** IERC20Metadata(l.stock).decimals());
        uint256 usdgValue = Math.mulDiv(usdgAmt * usdgTo18, mark.usdgUsd(), 1e18);
        uint256 keep = 10000 - l.maxSlipBps;
        if (selling ? usdgValue * 10000 < stockValue * keep : stockValue * 10000 < usdgValue * keep) revert OnixsBerthFill();
    }

    function _swapExactIn(address pool, address tokenIn, uint256 amountIn) internal returns (uint256 amountOut) {
        bool zeroForOne = tokenIn == IOnixsSwapPool(pool).token0();
        swapPool = pool;
        (int256 a0, int256 a1) = IOnixsSwapPool(pool).swap(
            address(this), zeroForOne, int256(amountIn), zeroForOne ? MIN_SQRT_RATIO_PLUS_ONE : MAX_SQRT_RATIO_MINUS_ONE, abi.encode(tokenIn)
        );
        swapPool = address(0);
        (int256 paid, int256 got) = zeroForOne ? (a0, a1) : (a1, a0);
        if (uint256(paid) != amountIn) revert OnixsBerthPartialFill();
        amountOut = uint256(-got);
    }

    function _swapExactOut(address pool, address tokenIn, uint256 amountOut, uint256 maxIn) internal returns (uint256 amountIn) {
        bool zeroForOne = tokenIn == IOnixsSwapPool(pool).token0();
        swapPool = pool;
        (int256 a0, int256 a1) = IOnixsSwapPool(pool).swap(
            address(this), zeroForOne, -int256(amountOut), zeroForOne ? MIN_SQRT_RATIO_PLUS_ONE : MAX_SQRT_RATIO_MINUS_ONE, abi.encode(tokenIn)
        );
        swapPool = address(0);
        (int256 paid, int256 got) = zeroForOne ? (a0, a1) : (a1, a0);
        if (uint256(-got) != amountOut) revert OnixsBerthPartialFill();
        amountIn = uint256(paid);
        if (amountIn > maxIn) revert OnixsBerthMaxIn();
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        if (msg.sender != swapPool || swapPool == address(0)) revert OnixsBerthBadCaller();
        address tokenIn = abi.decode(data, (address));
        uint256 pay = uint256(amount0Delta > 0 ? amount0Delta : amount1Delta);
        if (phase == CLOSE_SHORT && tokenIn == usdg) {
            uint256 bal = IERC20(usdg).balanceOf(address(this));
            if (bal < pay) IERC20(usdg).safeTransferFrom(owner, address(this), pay - bal);
        }
        IERC20(tokenIn).safeTransfer(msg.sender, pay);
    }
}

interface IOnixsLeaseholdLiquidity {
    function available() external view returns (uint256);
}

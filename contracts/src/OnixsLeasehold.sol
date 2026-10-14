// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOnixsMorpho, OnixsMarketParams, OnixsMarketState} from "./interfaces/IOnixsMorpho.sol";
import {OnixsAccrual} from "./OnixsAccrual.sol";

/// @title OnixsLeasehold
/// @notice One per stock token. Lenders deposit the stock and receive shares; every deposited token is supplied
///         to a single Morpho Blue market where the stock is the loan token and USDG is the collateral. Borrowers
///         (shorts) pay interest to that market, which raises what each share is worth. No owner, no fee, no
///         settings: the market is fixed at construction.
/// @dev Withdrawals can only take what the market has not lent out (maxWithdraw / maxRedeem say how much).
///      A decimals offset of 6 makes the first-deposit share inflation trick uneconomic.
contract OnixsLeasehold is ERC4626 {
    using SafeERC20 for IERC20;

    error OnixsLeaseholdBadMarket();

    IOnixsMorpho public immutable morpho;
    bytes32 public immutable marketId;

    address private immutable mLoan;
    address private immutable mCollateral;
    address private immutable mOracle;
    address private immutable mIrm;
    uint256 private immutable mLltv;

    constructor(address stock, address morpho_, OnixsMarketParams memory shortMarket, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(IERC20(stock))
    {
        if (shortMarket.loanToken != stock || shortMarket.collateralToken == stock) revert OnixsLeaseholdBadMarket();
        morpho = IOnixsMorpho(morpho_);
        mLoan = shortMarket.loanToken;
        mCollateral = shortMarket.collateralToken;
        mOracle = shortMarket.oracle;
        mIrm = shortMarket.irm;
        mLltv = shortMarket.lltv;
        marketId = OnixsAccrual.id(shortMarket);
        (,,,, uint128 lastUpdate,) = IOnixsMorpho(morpho_).market(marketId);
        if (lastUpdate == 0) IOnixsMorpho(morpho_).createMarket(shortMarket);
        IERC20(stock).forceApprove(morpho_, type(uint256).max);
    }

    /// @notice The Morpho market this leasehold lends into.
    function marketParams() public view returns (OnixsMarketParams memory) {
        return OnixsMarketParams(mLoan, mCollateral, mOracle, mIrm, mLltv);
    }

    /// @notice Stock the market holds that nobody has borrowed (what can be withdrawn right now, for everyone).
    function available() public view returns (uint256) {
        OnixsMarketState memory m = OnixsAccrual.accrued(morpho, marketParams());
        return m.totalSupplyAssets > m.totalBorrowAssets ? m.totalSupplyAssets - m.totalBorrowAssets : 0;
    }

    /// @notice Stock owed to this leasehold by the market, interest included up to this block.
    function totalAssets() public view override returns (uint256) {
        OnixsMarketState memory m = OnixsAccrual.accrued(morpho, marketParams());
        (uint256 supplyShares,,) = morpho.position(marketId, address(this));
        return OnixsAccrual.toAssetsDown(supplyShares, m.totalSupplyAssets, m.totalSupplyShares);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner), available());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner), _convertToShares(available(), Math.Rounding.Floor));
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        morpho.accrueInterest(marketParams());
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        morpho.accrueInterest(marketParams());
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        morpho.accrueInterest(marketParams());
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        morpho.accrueInterest(marketParams());
        return super.redeem(shares, receiver, owner);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        morpho.supply(marketParams(), assets, 0, address(this), "");
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
        morpho.withdraw(marketParams(), assets, 0, address(this), address(this));
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}

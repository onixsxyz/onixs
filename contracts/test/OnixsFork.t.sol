// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOnixsMorpho, OnixsMarketParams} from "../src/interfaces/IOnixsMorpho.sol";
import {IOnixsFeed, IOnixsSwapPool} from "../src/interfaces/IOnixsExternal.sol";
import {OnixsListing} from "../src/interfaces/IOnixsCharter.sol";
import {OnixsMark} from "../src/OnixsMark.sol";
import {OnixsLeasehold} from "../src/OnixsLeasehold.sol";
import {OnixsCharter} from "../src/OnixsCharter.sol";
import {OnixsBerth} from "../src/OnixsBerth.sol";

/// @dev Test-only trader that moves a pool's price with a plain swap.
contract PoolMover {
    function push(address pool, address tokenIn, uint256 amountIn) external {
        bool z = tokenIn == IOnixsSwapPool(pool).token0();
        IOnixsSwapPool(pool).swap(address(this), z, int256(amountIn), z ? 4295128740 : 1461446703485210103287273052203988822378723970341, abi.encode(tokenIn));
    }

    function uniswapV3SwapCallback(int256 a0, int256 a1, bytes calldata data) external {
        IERC20(abi.decode(data, (address))).transfer(msg.sender, uint256(a0 > 0 ? a0 : a1));
    }
}

/// @dev Fork tests against Robinhood Chain mainnet: real Morpho Blue, Uniswap v3 pools, Chainlink feeds, stock tokens.
///      Run: FORK_URL=https://robinhood.drpc.org forge test --match-contract OnixsFork --evm-version cancun -vv
contract OnixsForkTest is Test {
    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant IRM = 0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant USDG_FEED = 0x61B7e5650328764B076A108EFF5fa7282a1B9aD2;
    address constant FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;

    address constant SPY = 0x117cc2133c37B721F49dE2A7a74833232B3B4C0C;
    address constant SPY_FEED = 0x319724394D3A0e3669269846abE664Cd621f9f6A;
    address constant SPY_POOL = 0xa7Bb1AC63BBaB0C44316E6c8C455213441689167;
    address constant QQQ = 0xD5f3879160bc7c32ebb4dC785F8a4F505888de68;
    address constant QQQ_FEED = 0x80901d846d5D7B030F26B480776EE3b29374C2ae;
    address constant QQQ_POOL = 0xD60A5d14dB690B7Afad71F76B108071D7175597d;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant NVDA_FEED = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
    address constant NVDA_POOL = 0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3;

    uint256 constant SPY_ID = 0;
    uint256 constant QQQ_ID = 1;
    uint256 constant NVDA_ID = 2;

    IOnixsMorpho morpho = IOnixsMorpho(MORPHO);
    OnixsCharter charter;
    address owner = makeAddr("owner");
    address lender = makeAddr("lender");
    address usdgLender = makeAddr("usdgLender");
    address trader = makeAddr("trader");
    address stranger = makeAddr("stranger");
    PoolMover mover;

    mapping(uint256 => OnixsListing) internal L;

    function setUp() public {
        vm.createSelectFork(vm.envOr("FORK_URL", string("https://robinhood.drpc.org")));
        uint256 g = gasleft();
        charter = new OnixsCharter(owner, MORPHO, USDG, FACTORY);
        console2.log("gas OnixsCharter (with OnixsBerth implementation)", g - gasleft());
        _list(SPY, SPY_FEED, SPY_POOL, 0.77e18, 6500, 18000, "SPY");
        _list(QQQ, QQQ_FEED, QQQ_POOL, 0.77e18, 6500, 18000, "QQQ");
        _list(NVDA, NVDA_FEED, NVDA_POOL, 0.625e18, 5000, 18000, "NVDA");
        mover = new PoolMover();
    }

    function _list(address stock, address feed, address pool, uint256 shortLltv, uint16 openLtv, uint16 lev, string memory sym) internal {
        uint256 g = gasleft();
        OnixsMark shortMark = new OnixsMark(feed, stock, USDG_FEED, USDG, address(0));
        if (stock == SPY) console2.log("gas OnixsMark (short)", g - gasleft());
        OnixsMarketParams memory s = OnixsMarketParams(stock, USDG, address(shortMark), IRM, shortLltv);
        g = gasleft();
        OnixsLeasehold lh = new OnixsLeasehold(stock, MORPHO, s, string.concat("ONIXS Leasehold ", sym), string.concat("on", sym));
        if (stock == SPY) console2.log("gas OnixsLeasehold (creates the short market)", g - gasleft());
        OnixsMark creditMark = new OnixsMark(feed, stock, USDG_FEED, USDG, address(lh));
        OnixsMarketParams memory c = OnixsMarketParams(USDG, address(lh), address(creditMark), IRM, 0.625e18);
        OnixsListing memory l = OnixsListing(stock, feed, pool, address(lh), s, c, lev, openLtv, 300, 26 hours, false);
        vm.prank(owner);
        g = gasleft();
        uint256 id = charter.list(l);
        if (stock == SPY) console2.log("gas charter.list (creates the credit market)", g - gasleft());
        L[id] = l;
    }

    // ------------------------------------------------------------------ helpers

    function _fund(address token, address to, uint256 amount) internal {
        deal(token, to, amount);
    }

    function _lend(uint256 id, uint256 amount) internal returns (uint256 shares) {
        _fund(L[id].stock, lender, amount);
        vm.startPrank(lender);
        IERC20(L[id].stock).approve(L[id].leasehold, amount);
        shares = OnixsLeasehold(L[id].leasehold).deposit(amount, lender);
        vm.stopPrank();
    }

    function _supplyUsdg(uint256 id, uint256 amount) internal {
        _fund(USDG, usdgLender, amount);
        vm.startPrank(usdgLender);
        IERC20(USDG).approve(MORPHO, amount);
        morpho.supply(L[id].creditMarket, amount, 0, usdgLender, "");
        vm.stopPrank();
    }

    function _berth(address who) internal returns (OnixsBerth b) {
        vm.prank(who);
        b = OnixsBerth(payable(charter.openBerth()));
    }

    function _stockUsd(uint256 id) internal view returns (uint256) {
        return OnixsMark(L[id].shortMarket.oracle).stockUsd();
    }

    /// stock amount worth `usd` (6-decimal USDG units) at the feed price
    function _stockFor(uint256 id, uint256 usd) internal view returns (uint256) {
        return usd * 1e12 * 1e18 / _stockUsd(id);
    }

    function _movePool(uint256 id, bool up, uint256 usd) internal {
        address tokenIn = up ? USDG : L[id].stock;
        uint256 amount = up ? usd : _stockFor(id, usd);
        _fund(tokenIn, address(mover), amount);
        mover.push(L[id].pool, tokenIn, amount);
    }

    function _openShort(OnixsBerth b, uint256 id, uint256 margin, uint256 usdShort) internal returns (uint256 stockAmt) {
        stockAmt = _stockFor(id, usdShort);
        _fund(USDG, trader, margin);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), margin);
        b.openShort(id, margin, stockAmt, usdShort * 97 / 100);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ listing

    function test_listedThree() public view {
        assertEq(charter.listingCount(), 3);
        for (uint256 i; i < 3; i++) {
            OnixsListing memory l = charter.getListing(i);
            (,,,, uint128 s,) = morpho.market(keccak256(abi.encode(l.shortMarket)));
            (,,,, uint128 c,) = morpho.market(keccak256(abi.encode(l.creditMarket)));
            assertGt(s, 0);
            assertGt(c, 0);
        }
    }

    function test_listRejectsBadWiring() public {
        OnixsListing memory l = L[SPY_ID];
        l.pool = QQQ_POOL; // pool of another stock
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OnixsCharter.OnixsCharterInvalid.selector, "pool tokens"));
        charter.list(l);

        l = L[SPY_ID];
        l.shortOpenLtvBps = 7700; // at the market limit
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OnixsCharter.OnixsCharterInvalid.selector, "short open ltv"));
        charter.list(l);

        l = L[SPY_ID];
        l.creditMarket.oracle = L[SPY_ID].shortMarket.oracle; // short-mode mark on the credit market
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OnixsCharter.OnixsCharterInvalid.selector, "mark wiring"));
        charter.list(l);

        vm.prank(stranger);
        vm.expectRevert();
        charter.list(L[SPY_ID]);
    }

    function test_markNearPoolSpot() public {
        for (uint256 i; i < 3; i++) {
            uint256 feedUsd = _stockUsd(i); // 1e18 per whole token
            uint256 probe = 1e16; // 0.01 token
            _fund(L[i].stock, address(this), probe);
            uint256 before = IERC20(USDG).balanceOf(address(this));
            uint256 snap = vm.snapshotState();
            IERC20(L[i].stock).transfer(address(mover), probe);
            mover.push(L[i].pool, L[i].stock, probe);
            uint256 got = IERC20(USDG).balanceOf(address(mover));
            vm.revertToState(snap);
            uint256 poolUsd = got * 1e12 * 100; // per whole token, 18 decimals
            uint256 diff = poolUsd > feedUsd ? poolUsd - feedUsd : feedUsd - poolUsd;
            console2.log("stock", i, feedUsd / 1e14, poolUsd / 1e14);
            assertLt(diff * 10000 / feedUsd, 50, "mark within 0.5% of pool spot (incl. 0.05% fee)");
            before;
        }
    }

    // ------------------------------------------------------------------ lending

    function test_lendAndWithdraw() public {
        uint256 shares = _lend(NVDA_ID, 5e18);
        OnixsLeasehold lh = OnixsLeasehold(L[NVDA_ID].leasehold);
        assertEq(lh.balanceOf(lender), shares);
        assertApproxEqAbs(lh.totalAssets(), 5e18, 2);
        vm.prank(lender);
        lh.redeem(shares, lender, lender);
        assertApproxEqAbs(IERC20(NVDA).balanceOf(lender), 5e18, 2);
    }

    function test_rentAccruesToLenders() public {
        _lend(NVDA_ID, 10e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, NVDA_ID, 1000e6, 800e6);
        OnixsLeasehold lh = OnixsLeasehold(L[NVDA_ID].leasehold);
        uint256 t0 = lh.totalAssets();
        vm.warp(block.timestamp + 30 days);
        uint256 t1 = lh.totalAssets();
        assertGt(t1, t0, "lenders earn interest");
        // withdraw limited by what is not lent out
        assertLe(lh.maxWithdraw(lender), lh.available());
    }

    function test_inflationAttackUneconomic() public {
        // attacker deposits 1 wei then donates by supplying on behalf of the leasehold
        address attacker = makeAddr("attacker");
        OnixsLeasehold lh = OnixsLeasehold(L[SPY_ID].leasehold);
        _fund(SPY, attacker, 1e18 + 1);
        vm.startPrank(attacker);
        IERC20(SPY).approve(address(lh), 1);
        lh.deposit(1, attacker);
        IERC20(SPY).approve(MORPHO, 1e18);
        morpho.supply(L[SPY_ID].shortMarket, 1e18, 0, address(lh), "");
        vm.stopPrank();
        // a victim's deposit still mints shares and keeps nearly all of its value
        _fund(SPY, lender, 1e18);
        vm.startPrank(lender);
        IERC20(SPY).approve(address(lh), 1e18);
        uint256 s = lh.deposit(1e18, lender);
        vm.stopPrank();
        assertGt(s, 0);
        assertGt(lh.convertToAssets(s), 0.999e18);
    }

    function test_usdgLendAndBorrowAgainstShares() public {
        _supplyUsdg(NVDA_ID, 10_000e6);
        uint256 shares = _lend(NVDA_ID, 10e18);
        // the lender posts leasehold shares directly on Morpho and borrows USDG, no ONIXS contract in between
        vm.startPrank(lender);
        IERC20(L[NVDA_ID].leasehold).approve(MORPHO, shares);
        morpho.supplyCollateral(L[NVDA_ID].creditMarket, shares, lender, "");
        uint256 value = 10 * _stockUsd(NVDA_ID) / 1e12; // USDG units
        morpho.borrow(L[NVDA_ID].creditMarket, value / 2, 0, lender, lender);
        vm.expectRevert(); // over the 62.5% limit
        morpho.borrow(L[NVDA_ID].creditMarket, value / 5, 0, lender, lender);
        vm.stopPrank();
        assertEq(IERC20(USDG).balanceOf(lender), value / 2);
    }

    // ------------------------------------------------------------------ shorts

    function test_shortProfit() public {
        _lend(NVDA_ID, 10e18);
        OnixsBerth b = _berth(trader);
        uint256 stockAmt = _openShort(b, NVDA_ID, 1000e6, 900e6);
        (uint256 debt, uint256 col) = b.shortOf(NVDA_ID);
        assertApproxEqAbs(debt, stockAmt, 2);
        assertGt(col, 1000e6 + 870e6);

        _movePool(NVDA_ID, false, 300_000e6); // someone sells a lot: the price falls
        vm.prank(trader);
        b.closeShort(NVDA_ID, type(uint256).max);
        uint256 back = IERC20(USDG).balanceOf(trader);
        console2.log("short profit: margin 1000 USDG, back", back / 1e6);
        assertGt(back, 1000e6);
        (debt, col) = b.shortOf(NVDA_ID);
        assertEq(debt, 0);
        assertEq(col, 0);
    }

    function test_shortLossAndTopUp() public {
        _lend(NVDA_ID, 20e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, NVDA_ID, 1000e6, 900e6);
        _movePool(NVDA_ID, true, 400_000e6); // the price rises: the collateral still covers the buy-back
        uint256 snap = vm.snapshotState();
        vm.prank(trader);
        b.closeShort(NVDA_ID, type(uint256).max);
        uint256 back = IERC20(USDG).balanceOf(trader);
        console2.log("short loss: margin 1000 USDG, back", back / 1e6);
        assertLt(back, 1000e6);
        vm.revertToState(snap);

        // The top-up branch: when the berth holds less USDG than the buy-back costs, the gap is pulled from the
        // owner's wallet. Real pools on this chain run out of in-range stock before the price doubles (the close
        // then reverts, see test_thinPoolBuyBackReverts), so the shortfall is simulated by hiding the berth's balance.
        vm.mockCall(USDG, abi.encodeWithSelector(IERC20.balanceOf.selector, address(b)), abi.encode(uint256(0)));
        _fund(USDG, trader, 50_000e6);
        vm.prank(trader);
        vm.expectRevert(); // no allowance for the gap yet
        b.closeShort(NVDA_ID, type(uint256).max);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), type(uint256).max);
        b.closeShort(NVDA_ID, 60_000e6);
        vm.stopPrank();
        uint256 afterPull = IERC20(USDG).balanceOf(trader);
        vm.clearMockedCalls();
        assertLt(afterPull, 50_000e6, "the buy-back was paid from the wallet");
        (uint256 debt,) = b.shortOf(NVDA_ID);
        assertEq(debt, 0);
        vm.prank(trader);
        b.sweep(USDG, trader); // the untouched collateral comes back
        assertGt(IERC20(USDG).balanceOf(trader), 50_000e6);
    }

    /// The SPY pool's stock side is thin: a large buy empties it and a buy-back cannot fill (it reverts, nothing is lost).
    function test_thinPoolBuyBackReverts() public {
        _lend(SPY_ID, 5e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, SPY_ID, 1000e6, 1500e6);
        // Buy far more than the pool's whole stock side (sized from its live balance, which changes day to day),
        // so the pool is drained and an exact-output buy-back of the debt cannot fill.
        uint256 poolStockUsd = IERC20(L[SPY_ID].stock).balanceOf(L[SPY_ID].pool) * _stockUsd(SPY_ID) / 1e30;
        _movePool(SPY_ID, true, poolStockUsd * 3);
        _fund(USDG, trader, 50_000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), type(uint256).max);
        vm.expectRevert();
        b.closeShort(SPY_ID, 50_000e6);
        vm.stopPrank();
        (uint256 debt,) = b.shortOf(SPY_ID);
        assertGt(debt, 0, "position untouched");
    }

    function test_shortOverLimitRefused() public {
        _lend(NVDA_ID, 10e18);
        OnixsBerth b = _berth(trader);
        uint256 stockAmt = _stockFor(NVDA_ID, 1300e6); // 1300 / 2300 = 56% > 50% open cap, < 62.5% market limit
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        vm.expectRevert(OnixsBerth.OnixsBerthOpenLimit.selector);
        b.openShort(NVDA_ID, 1000e6, stockAmt, 1240e6);
        vm.stopPrank();
    }

    function test_slippageGuard() public {
        _lend(NVDA_ID, 10e18);
        OnixsBerth b = _berth(trader);
        // feed says the stock is worth 10% more than the pool pays: the fill is refused
        (uint80 r, int256 a, uint256 s, uint256 u, uint80 ar) = IOnixsFeed(NVDA_FEED).latestRoundData();
        vm.mockCall(NVDA_FEED, abi.encodeWithSelector(IOnixsFeed.latestRoundData.selector), abi.encode(r, a * 110 / 100, s, u, ar));
        uint256 stockAmt = _stockFor(NVDA_ID, 500e6);
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        vm.expectRevert(OnixsBerth.OnixsBerthFill.selector);
        b.openShort(NVDA_ID, 1000e6, stockAmt, 1);
        // and a user min out above what the pool pays is refused too
        vm.clearMockedCalls();
        stockAmt = _stockFor(NVDA_ID, 500e6);
        vm.expectRevert(OnixsBerth.OnixsBerthMinOut.selector);
        b.openShort(NVDA_ID, 1000e6, stockAmt, 510e6);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ longs

    function test_longOpenClose18x() public {
        _supplyUsdg(NVDA_ID, 20_000e6);
        _lend(NVDA_ID, 1e18);
        OnixsBerth b = _berth(trader);
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        b.openLong(NVDA_ID, 1000e6, 800e6, _stockFor(NVDA_ID, 1800e6) * 97 / 100);
        vm.stopPrank();
        (uint256 debt, uint256 shares) = b.longOf(NVDA_ID);
        assertApproxEqAbs(debt, 800e6, 1);
        uint256 stock = OnixsLeasehold(L[NVDA_ID].leasehold).convertToAssets(shares);
        uint256 value = stock * _stockUsd(NVDA_ID) / 1e30;
        console2.log("long: posted stock value USDG", value / 1e6);
        assertGt(value, 1750e6);

        vm.warp(block.timestamp + 1 days);
        vm.prank(trader);
        b.closeLong(NVDA_ID, 900e6);
        uint256 back = IERC20(USDG).balanceOf(trader);
        console2.log("long closed, back", back / 1e6);
        assertGt(back, 980e6);
        (debt, shares) = b.longOf(NVDA_ID);
        assertEq(debt, 0);
        assertEq(shares, 0);
    }

    function test_longOverLeverageRefused() public {
        _supplyUsdg(NVDA_ID, 20_000e6);
        OnixsBerth b = _berth(trader);
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        vm.expectRevert(OnixsBerth.OnixsBerthLeverage.selector);
        b.openLong(NVDA_ID, 1000e6, 801e6, 0);
        vm.stopPrank();
    }

    function test_longCloseRefusedWhenLeaseholdLentOut() public {
        _supplyUsdg(NVDA_ID, 20_000e6);
        OnixsBerth b = _berth(trader);
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        b.openLong(NVDA_ID, 1000e6, 500e6, 0);
        vm.stopPrank();
        // a shorter borrows everything the leasehold lends (the long's own stock)
        OnixsBerth s = _berth(stranger);
        uint256 avail = OnixsLeasehold(L[NVDA_ID].leasehold).available();
        _fund(USDG, stranger, 10_000e6);
        vm.startPrank(stranger);
        IERC20(USDG).approve(address(s), 10_000e6);
        s.openShort(NVDA_ID, 10_000e6, avail, 1);
        vm.stopPrank();
        vm.prank(trader);
        vm.expectRevert(OnixsBerth.OnixsBerthLeaseholdBusy.selector);
        b.closeLong(NVDA_ID, 0);
        // once the short is closed, the long can close
        vm.prank(stranger);
        s.closeShort(NVDA_ID, type(uint256).max);
        vm.prank(trader);
        b.closeLong(NVDA_ID, 0);
    }

    // ------------------------------------------------------------------ pairs

    function test_pairOpenClose() public {
        _supplyUsdg(NVDA_ID, 20_000e6);
        _lend(SPY_ID, 5e18);
        OnixsBerth b = _berth(trader);
        _fund(USDG, trader, 2000e6);
        OnixsBerth.PairOpen memory p = OnixsBerth.PairOpen({
            longId: NVDA_ID,
            longMargin: 1000e6,
            loan: 500e6,
            minStockOut: 0,
            shortId: SPY_ID,
            shortMargin: 1000e6,
            stockAmount: _stockFor(SPY_ID, 1000e6),
            minUsdgOut: 960e6
        });
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 2000e6);
        b.openPair(p);
        (uint256 d1,) = b.longOf(NVDA_ID);
        (uint256 d2,) = b.shortOf(SPY_ID);
        assertGt(d1, 0);
        assertGt(d2, 0);
        b.closePair(NVDA_ID, SPY_ID, type(uint256).max, 1900e6);
        vm.stopPrank();
        assertGt(IERC20(USDG).balanceOf(trader), 1900e6);
    }

    // ------------------------------------------------------------------ pause, staleness, access

    function test_pausedRefusesOpensButClosesWork() public {
        _lend(QQQ_ID, 5e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, QQQ_ID, 1000e6, 1000e6);
        vm.prank(owner);
        charter.setPaused(QQQ_ID, true);
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        vm.expectRevert(OnixsBerth.OnixsBerthPaused.selector);
        b.openShort(QQQ_ID, 1000e6, 1e15, 0);
        b.closeShort(QQQ_ID, type(uint256).max);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(OnixsCharter.OnixsCharterNotOwner.selector);
        charter.setPaused(QQQ_ID, false);
        assertEq(charter.owner(), owner);
    }

    function test_staleFeedRefusesOpensButClosesWork() public {
        _lend(SPY_ID, 5e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, SPY_ID, 1000e6, 1000e6);
        vm.warp(block.timestamp + 3 days); // a long weekend: no feed update
        _fund(USDG, trader, 1000e6);
        vm.startPrank(trader);
        IERC20(USDG).approve(address(b), 1000e6);
        vm.expectRevert(OnixsBerth.OnixsBerthStaleFeed.selector);
        b.openShort(SPY_ID, 1000e6, 1e15, 0);
        b.closeShort(SPY_ID, type(uint256).max);
        vm.stopPrank();
        assertGt(IERC20(USDG).balanceOf(trader), 1900e6);
    }

    function test_accessControl() public {
        OnixsBerth b = _berth(trader);
        vm.startPrank(stranger);
        vm.expectRevert(OnixsBerth.OnixsBerthNotOwner.selector);
        b.openShort(0, 1, 1, 1);
        vm.expectRevert(OnixsBerth.OnixsBerthNotOwner.selector);
        b.closeLong(0, 0);
        vm.expectRevert(OnixsBerth.OnixsBerthNotOwner.selector);
        b.ownerCall(USDG, 0, "");
        vm.expectRevert(OnixsBerth.OnixsBerthNotOwner.selector);
        b.sweep(USDG, stranger);
        // callbacks from anyone but Morpho / the expected pool are refused
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        b.onMorphoFlashLoan(1, "");
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        b.onMorphoRepay(1, "");
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        b.onMorphoSupplyCollateral(1, "");
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        b.uniswapV3SwapCallback(1, 0, abi.encode(USDG));
        vm.expectRevert(OnixsCharter.OnixsCharterNotBerth.selector);
        charter.record(1, 0, 0, 0, 0, 0);
        vm.stopPrank();
        // Morpho itself cannot drive a callback while the berth is idle
        vm.prank(MORPHO);
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        b.onMorphoFlashLoan(1, "");
        // one berth per wallet, at the predicted address
        assertEq(charter.predictBerth(trader), address(b));
        vm.prank(trader);
        vm.expectRevert(OnixsCharter.OnixsCharterBerthExists.selector);
        charter.openBerth();
        vm.prank(trader);
        vm.expectRevert(OnixsBerth.OnixsBerthForbiddenTarget.selector);
        b.ownerCall(address(charter), 0, abi.encodeWithSelector(OnixsCharter.record.selector, 1, 0, 0, 0, 0, 0));
    }

    function test_ownerCallEscape() public {
        _lend(NVDA_ID, 10e18);
        OnixsBerth b = _berth(trader);
        _openShort(b, NVDA_ID, 1000e6, 500e6);
        (uint256 debt, uint256 col) = b.shortOf(NVDA_ID);
        // the owner repays on Morpho directly with stock from their wallet, then takes the collateral back
        _fund(NVDA, address(b), debt + 1e12);
        vm.startPrank(trader);
        b.ownerCall(NVDA, 0, abi.encodeWithSelector(IERC20.approve.selector, MORPHO, debt + 1e12));
        (, uint128 bs,) = morpho.position(keccak256(abi.encode(L[NVDA_ID].shortMarket)), address(b));
        b.ownerCall(MORPHO, 0, abi.encodeWithSelector(IOnixsMorpho.repay.selector, L[NVDA_ID].shortMarket, 0, uint256(bs), address(b), ""));
        b.ownerCall(MORPHO, 0, abi.encodeWithSelector(IOnixsMorpho.withdrawCollateral.selector, L[NVDA_ID].shortMarket, col, address(b), trader));
        b.sweep(NVDA, trader);
        vm.stopPrank();
        assertEq(IERC20(USDG).balanceOf(trader), col);
    }

    function test_berthImplementationLocked() public {
        OnixsBerth impl = OnixsBerth(payable(charter.berthImplementation()));
        assertEq(impl.owner(), address(1));
        vm.expectRevert(OnixsBerth.OnixsBerthBadCaller.selector);
        impl.initialize(stranger);
    }
}

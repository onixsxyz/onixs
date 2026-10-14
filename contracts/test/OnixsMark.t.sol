// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OnixsMark} from "../src/OnixsMark.sol";
import {OnixsAccrual} from "../src/OnixsAccrual.sol";

contract FakeFeed {
    int256 public answer;
    uint256 public updatedAt;
    uint8 public decimals;
    constructor(int256 a, uint8 d) { answer = a; decimals = d; updatedAt = block.timestamp; }
    function set(int256 a, uint256 t) external { answer = a; updatedAt = t; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract FakeToken {
    uint8 public decimals;
    uint256 public multiplier = 1e18;
    bool public broken;
    constructor(uint8 d) { decimals = d; }
    function setMultiplier(uint256 m) external { multiplier = m; }
    function setBroken(bool b) external { broken = b; }
    function uiMultiplier() external view returns (uint256) {
        require(!broken, "paused");
        return multiplier;
    }
}

contract FakeShares {
    address public asset;
    uint8 public decimals = 24;
    uint256 public perShare; // raw assets per 1e24 shares
    constructor(address a, uint256 p) { asset = a; perShare = p; }
    function set(uint256 p) external { perShare = p; }
    function convertToAssets(uint256 shares) external view returns (uint256) { return shares * perShare / 1e24; }
}

contract OnixsMarkTest is Test {
    FakeFeed stockFeed;
    FakeFeed usdgFeed;
    FakeToken stock;
    FakeToken usdg;
    FakeShares lh;
    OnixsMark shortMark;
    OnixsMark creditMark;

    function setUp() public {
        vm.warp(1_800_000_000);
        stockFeed = new FakeFeed(780e8, 8); // $780 per displayed share
        usdgFeed = new FakeFeed(1e8, 8);
        stock = new FakeToken(18);
        usdg = new FakeToken(6);
        lh = new FakeShares(address(stock), 1e18);
        shortMark = new OnixsMark(address(stockFeed), address(stock), address(usdgFeed), address(usdg), address(0));
        creditMark = new OnixsMark(address(stockFeed), address(stock), address(usdgFeed), address(usdg), address(lh));
    }

    function test_shortModePrice() public view {
        // 1 raw USDG unit (1e-6 USDG) in raw stock units (1e-18 tokens), times 1e36
        // = (1e-6 / 780) * 1e18 * 1e36 = 1e48 / 780
        assertEq(shortMark.price(), uint256(1e48) / 780);
        assertEq(shortMark.stockUsd(), 780e18);
    }

    function test_creditModePrice() public view {
        // 1 raw share = 1e-24 shares = 1e-24 stock; in USDG raw: 1e-24 * 780 * 1e6; times 1e36 = 780e18
        assertEq(creditMark.price(), 780e18);
    }

    function test_creditModeFollowsShareValue() public {
        lh.set(1.05e18); // rent raised each share by 5%
        assertEq(creditMark.price(), 819e18);
    }

    function test_multiplierRaisesRawValue() public {
        stock.setMultiplier(2e18); // a 2-for-1 split: one raw token is now two displayed shares
        assertEq(shortMark.stockUsd(), 1560e18);
        assertEq(shortMark.price(), uint256(1e48) / 1560);
        assertEq(creditMark.price(), 1560e18);
    }

    function test_multiplierUnreadableFallsBackToOne() public {
        stock.setBroken(true);
        assertEq(shortMark.stockUsd(), 780e18);
    }

    function test_usdgCappedAtOneDollar() public {
        usdgFeed.set(1.02e8, block.timestamp);
        assertEq(shortMark.usdgUsd(), 1e18);
        usdgFeed.set(0.97e8, block.timestamp);
        assertEq(shortMark.usdgUsd(), 0.97e18);
        // a USDG below peg: posted USDG is worth less stock (short mode), USDG debt is smaller (credit mode)
        assertEq(shortMark.price(), uint256(0.97e18) * 1e48 / 780e18);
        assertEq(creditMark.price(), uint256(780e18) * 1e18 / 0.97e18);
    }

    function test_staleFeedDoesNotRevert() public {
        stockFeed.set(780e8, block.timestamp - 10 days);
        assertGt(shortMark.price(), 0);
        assertEq(shortMark.feedUpdatedAt(), block.timestamp - 10 days);
    }

    function test_badAnswerReverts() public {
        stockFeed.set(0, block.timestamp);
        vm.expectRevert(OnixsMark.OnixsMarkBadAnswer.selector);
        shortMark.price();
        stockFeed.set(-1, block.timestamp);
        vm.expectRevert(OnixsMark.OnixsMarkBadAnswer.selector);
        creditMark.price();
    }

    function test_wrongLeaseholdAssetRejected() public {
        FakeShares other = new FakeShares(address(usdg), 1e18);
        vm.expectRevert(OnixsMark.OnixsMarkBadDecimals.selector);
        new OnixsMark(address(stockFeed), address(stock), address(usdgFeed), address(usdg), address(other));
    }

    function testFuzz_shortPriceInverse(uint64 dollars) public {
        vm.assume(dollars > 0 && dollars < 1e12);
        stockFeed.set(int256(uint256(dollars)) * 1e8, block.timestamp);
        uint256 p = shortMark.price();
        // collateral worth X dollars of USDG borrows X / price stock: p * stockUsd == 1e66 within rounding
        uint256 back = p * shortMark.stockUsd() / 1e48;
        assertApproxEqRel(back, 1e18, 1e9);
    }

    function test_taylorMatchesExpForSmallRates() public pure {
        // 5% a year for one year: e^0.05 - 1 = 0.051271...; the three-term series is within 3e-6
        uint256 perSecond = uint256(0.05e18) / 365 days;
        uint256 g = OnixsAccrual.taylor(perSecond, 365 days);
        assertApproxEqAbs(g, 0.051271e18, 0.000003e18);
    }
}

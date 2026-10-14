// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IOnixsMorpho, OnixsMarketParams} from "./interfaces/IOnixsMorpho.sol";
import {IOnixsSwapPool, IOnixsSwapFactory} from "./interfaces/IOnixsExternal.sol";
import {OnixsListing} from "./interfaces/IOnixsCharter.sol";
import {OnixsAccrual} from "./OnixsAccrual.sol";
import {OnixsBerth} from "./OnixsBerth.sol";

interface IOnixsMarkView {
    function stock() external view returns (address);
    function stockFeed() external view returns (address);
    function usdg() external view returns (address);
    function leasehold() external view returns (address);
    function price() external view returns (uint256);
}

/// @title OnixsCharter
/// @notice The list of stocks ONIXS trades, and the place every wallet's berth is created. A listing is checked
///         on chain when it is added and can never be edited afterwards; the owner can only pause a listing,
///         which stops new opens while closes keep working. The charter never holds user funds.
contract OnixsCharter is Ownable2Step {
    error OnixsCharterInvalid(string what);
    error OnixsCharterUnknownListing();
    error OnixsCharterBerthExists();
    error OnixsCharterNotBerth();
    error OnixsCharterDeployFailed();

    event Listed(uint256 indexed id, address indexed stock, address leasehold, bytes32 shortMarketId, bytes32 creditMarketId);
    event PausedSet(uint256 indexed id, bool paused);
    event BerthOpened(address indexed owner, address indexed berth);
    event ShortOpened(address indexed owner, address indexed berth, uint256 indexed id, uint256 marginUsdg, uint256 stockBorrowed, uint256 usdgFromSale);
    event ShortClosed(address indexed owner, address indexed berth, uint256 indexed id, uint256 stockRepaid, uint256 usdgSpent, uint256 usdgReturned);
    event LongOpened(address indexed owner, address indexed berth, uint256 indexed id, uint256 marginUsdg, uint256 loanUsdg, uint256 stockBought, uint256 sharesPosted);
    event LongClosed(address indexed owner, address indexed berth, uint256 indexed id, uint256 loanRepaid, uint256 stockSold, uint256 usdgReturned);

    uint8 internal constant KIND_SHORT_OPENED = 1;
    uint8 internal constant KIND_SHORT_CLOSED = 2;
    uint8 internal constant KIND_LONG_OPENED = 3;
    uint8 internal constant KIND_LONG_CLOSED = 4;

    address public immutable morpho;
    address public immutable usdg;
    address public immutable swapFactory;
    address public immutable berthImplementation;

    OnixsListing[] private listings;
    mapping(address => address) public berthOf;
    mapping(address => bool) public isBerth;

    constructor(address owner_, address morpho_, address usdg_, address swapFactory_) Ownable(owner_) {
        morpho = morpho_;
        usdg = usdg_;
        swapFactory = swapFactory_;
        berthImplementation = address(new OnixsBerth(morpho_, usdg_));
    }

    // ------------------------------------------------------------------ listings

    function listingCount() external view returns (uint256) {
        return listings.length;
    }

    function getListing(uint256 id) external view returns (OnixsListing memory) {
        if (id >= listings.length) revert OnixsCharterUnknownListing();
        return listings[id];
    }

    /// @notice Adds a stock. Every address and limit is checked against the chain before it is stored.
    function list(OnixsListing calldata l) external onlyOwner returns (uint256 id) {
        IOnixsMorpho m = IOnixsMorpho(morpho);
        OnixsMarketParams calldata s = l.shortMarket;
        OnixsMarketParams calldata c = l.creditMarket;

        if (l.stock.code.length == 0 || l.feed.code.length == 0) revert OnixsCharterInvalid("stock or feed");
        if (l.leasehold.code.length == 0 || IERC4626(l.leasehold).asset() != l.stock) revert OnixsCharterInvalid("leasehold");

        // Short market: the stock is lent against USDG, priced by a short-mode mark of this stock and feed.
        if (s.loanToken != l.stock || s.collateralToken != usdg) revert OnixsCharterInvalid("short tokens");
        if (!m.isIrmEnabled(s.irm) || !m.isLltvEnabled(s.lltv) || s.irm == address(0)) revert OnixsCharterInvalid("short irm/lltv");
        _checkMark(s.oracle, l.stock, l.feed, address(0));
        if (IOnixsLeaseholdId(l.leasehold).marketId() != OnixsAccrual.id(s)) revert OnixsCharterInvalid("leasehold market");

        // Credit market: USDG is lent against leasehold shares, priced by a credit-mode mark of the same feed.
        if (c.loanToken != usdg || c.collateralToken != l.leasehold) revert OnixsCharterInvalid("credit tokens");
        if (!m.isIrmEnabled(c.irm) || !m.isLltvEnabled(c.lltv) || c.irm == address(0)) revert OnixsCharterInvalid("credit irm/lltv");
        _checkMark(c.oracle, l.stock, l.feed, l.leasehold);

        // Swap venue: a real Uniswap v3 pool of exactly this stock and USDG.
        if (l.pool.code.length == 0) revert OnixsCharterInvalid("pool");
        address t0 = IOnixsSwapPool(l.pool).token0();
        address t1 = IOnixsSwapPool(l.pool).token1();
        if (!((t0 == l.stock && t1 == usdg) || (t0 == usdg && t1 == l.stock))) revert OnixsCharterInvalid("pool tokens");
        if (IOnixsSwapFactory(swapFactory).getPool(t0, t1, IOnixsSwapPool(l.pool).fee()) != l.pool) revert OnixsCharterInvalid("pool factory");

        // Limits.
        if (l.shortOpenLtvBps == 0 || uint256(l.shortOpenLtvBps) * 1e14 >= s.lltv) revert OnixsCharterInvalid("short open ltv");
        if (l.maxSlipBps == 0 || l.maxSlipBps > 1000) revert OnixsCharterInvalid("slip");
        if (l.maxFeedAge == 0 || l.maxFeedAge > 7 days) revert OnixsCharterInvalid("feed age");
        if (l.maxLeverageBps != 0) {
            if (l.maxLeverageBps <= 10000 || l.maxLeverageBps > 20000) revert OnixsCharterInvalid("leverage");
            // debt / collateral at the cap is (x - 1) / x; keep it under 80% of the credit market's limit.
            uint256 impliedWad = (uint256(l.maxLeverageBps) - 10000) * 1e18 / l.maxLeverageBps;
            if (impliedWad * 10 > c.lltv * 8) revert OnixsCharterInvalid("leverage vs lltv");
        }
        if (l.paused) revert OnixsCharterInvalid("paused at listing");

        (,,,, uint128 sUpdate,) = m.market(OnixsAccrual.id(s));
        if (sUpdate == 0) m.createMarket(s);
        (,,,, uint128 cUpdate,) = m.market(OnixsAccrual.id(c));
        if (cUpdate == 0) m.createMarket(c);

        id = listings.length;
        listings.push(l);
        emit Listed(id, l.stock, l.leasehold, OnixsAccrual.id(s), OnixsAccrual.id(c));
    }

    function setPaused(uint256 id, bool paused) external onlyOwner {
        if (id >= listings.length) revert OnixsCharterUnknownListing();
        listings[id].paused = paused;
        emit PausedSet(id, paused);
    }

    function _checkMark(address mark, address stock, address feed, address leasehold) internal view {
        if (mark.code.length == 0) revert OnixsCharterInvalid("mark");
        IOnixsMarkView v = IOnixsMarkView(mark);
        if (v.stock() != stock || v.stockFeed() != feed || v.usdg() != usdg || v.leasehold() != leasehold) {
            revert OnixsCharterInvalid("mark wiring");
        }
        if (v.price() == 0) revert OnixsCharterInvalid("mark price");
    }

    // ------------------------------------------------------------------ berths

    /// @notice Creates the caller's berth: a minimal proxy (EIP-1167) at a CREATE2 address derived from the wallet.
    function openBerth() external returns (address berth) {
        if (berthOf[msg.sender] != address(0)) revert OnixsCharterBerthExists();
        bytes memory code = _proxyCode();
        bytes32 salt = bytes32(uint256(uint160(msg.sender)));
        assembly ("memory-safe") {
            berth := create2(0, add(code, 0x20), mload(code), salt)
        }
        if (berth == address(0)) revert OnixsCharterDeployFailed();
        berthOf[msg.sender] = berth;
        isBerth[berth] = true;
        OnixsBerth(payable(berth)).initialize(msg.sender);
        emit BerthOpened(msg.sender, berth);
    }

    /// @notice Where a wallet's berth lives (or will live once opened).
    function predictBerth(address user) external view returns (address) {
        bytes32 h = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), bytes32(uint256(uint160(user))), keccak256(_proxyCode()))
        );
        return address(uint160(uint256(h)));
    }

    function _proxyCode() internal view returns (bytes memory) {
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", berthImplementation, hex"5af43d82803e903d91602b57fd5bf3"
        );
    }

    /// @notice Berths report what they did here, so the whole site reads its history from one address.
    function record(uint8 kind, uint256 id, uint256 a, uint256 b, uint256 c, uint256 d) external {
        if (!isBerth[msg.sender]) revert OnixsCharterNotBerth();
        address owner_ = OnixsBerth(payable(msg.sender)).owner();
        if (kind == KIND_SHORT_OPENED) emit ShortOpened(owner_, msg.sender, id, a, b, c);
        else if (kind == KIND_SHORT_CLOSED) emit ShortClosed(owner_, msg.sender, id, a, b, c);
        else if (kind == KIND_LONG_OPENED) emit LongOpened(owner_, msg.sender, id, a, b, c, d);
        else if (kind == KIND_LONG_CLOSED) emit LongClosed(owner_, msg.sender, id, a, b, c);
    }
}

interface IOnixsLeaseholdId {
    function marketId() external view returns (bytes32);
}

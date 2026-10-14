// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {OnixsMarketParams} from "../src/interfaces/IOnixsMorpho.sol";
import {OnixsListing} from "../src/interfaces/IOnixsCharter.sol";
import {OnixsMark} from "../src/OnixsMark.sol";
import {OnixsLeasehold} from "../src/OnixsLeasehold.sol";
import {OnixsCharter} from "../src/OnixsCharter.sol";

/// @notice Deploys the charter and lists SPY, QQQ and NVDA with the recommended limits. The broadcaster becomes
///         the charter owner (it must be, to call list). Used for rehearsals on an anvil fork; the owner can also
///         deploy from the site's local /deploy page, which sends the same transactions in the same order.
///   forge script script/OnixsDeploy.s.sol --rpc-url <anvil> --broadcast --private-key <key> --evm-version cancun
contract OnixsDeploy is Script {
    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant IRM = 0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant USDG_FEED = 0x61B7e5650328764B076A108EFF5fa7282a1B9aD2;
    address constant FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;

    function run() external {
        vm.startBroadcast();
        OnixsCharter charter = new OnixsCharter(msg.sender, MORPHO, USDG, FACTORY);
        console2.log("CHARTER", address(charter), block.number);
        _list(charter, "SPY", 0x117cc2133c37B721F49dE2A7a74833232B3B4C0C, 0x319724394D3A0e3669269846abE664Cd621f9f6A, 0xa7Bb1AC63BBaB0C44316E6c8C455213441689167, 0.77e18, 6500);
        _list(charter, "QQQ", 0xD5f3879160bc7c32ebb4dC785F8a4F505888de68, 0x80901d846d5D7B030F26B480776EE3b29374C2ae, 0xD60A5d14dB690B7Afad71F76B108071D7175597d, 0.77e18, 6500);
        _list(charter, "NVDA", 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15, 0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3, 0.625e18, 5000);
        vm.stopBroadcast();
    }

    function _list(OnixsCharter charter, string memory sym, address stock, address feed, address pool, uint256 shortLltv, uint16 openLtv) internal {
        OnixsMark shortMark = new OnixsMark(feed, stock, USDG_FEED, USDG, address(0));
        OnixsMarketParams memory s = OnixsMarketParams(stock, USDG, address(shortMark), IRM, shortLltv);
        OnixsLeasehold lh = new OnixsLeasehold(stock, MORPHO, s, string.concat("ONIXS Leasehold ", sym), string.concat("on", sym));
        OnixsMark creditMark = new OnixsMark(feed, stock, USDG_FEED, USDG, address(lh));
        OnixsMarketParams memory c = OnixsMarketParams(USDG, address(lh), address(creditMark), IRM, 0.625e18);
        charter.list(OnixsListing(stock, feed, pool, address(lh), s, c, 18000, openLtv, 300, 26 hours, false));
        console2.log(sym, address(shortMark), address(lh), address(creditMark));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OnixsMarketParams} from "./IOnixsMorpho.sol";

/// @notice One listed stock: its price feed, swap venue, leasehold and the two Morpho markets around it.
struct OnixsListing {
    address stock;
    address feed;
    address pool;
    address leasehold;
    OnixsMarketParams shortMarket; // loan = stock, collateral = USDG
    OnixsMarketParams creditMarket; // loan = USDG, collateral = leasehold shares
    uint16 maxLeverageBps; // 0 = no leveraged longs; 18000 = 1.8x
    uint16 shortOpenLtvBps; // the most a short may use of its collateral when it opens
    uint16 maxSlipBps; // the furthest a fill may land from the feed price when a position opens
    uint32 maxFeedAge; // opens are refused when the stock feed is older than this (seconds)
    bool paused; // stops opens only; closes always work
}

interface IOnixsCharter {
    function morpho() external view returns (address);
    function usdg() external view returns (address);
    function listingCount() external view returns (uint256);
    function getListing(uint256 id) external view returns (OnixsListing memory);
    function record(uint8 kind, uint256 id, uint256 a, uint256 b, uint256 c, uint256 d) external;
}

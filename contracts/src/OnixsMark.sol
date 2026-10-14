// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IOnixsFeed, IOnixsStockToken} from "./interfaces/IOnixsExternal.sol";

/// @title OnixsMark
/// @notice Price source for the two Morpho Blue markets ONIXS lists per stock. Immutable, no owner.
///         Short mode (leasehold == 0): collateral is USDG, the loan is the stock token.
///         Credit mode (leasehold != 0): collateral is leasehold shares, the loan is USDG.
///         price() follows Morpho's convention: one raw collateral unit quoted in raw loan units, times 1e36.
/// @dev The stock feed prices one displayed share; the token's uiMultiplier converts it to one raw token
///      (dividends and splits move the multiplier, not balances). USDG is valued at min(feed, $1), which is the
///      careful side in both modes. Staleness never makes price() revert: repayments and liquidations must keep
///      working over weekends. Opening positions is gated on feed age elsewhere (OnixsBerth).
contract OnixsMark {
    error OnixsMarkBadAnswer();
    error OnixsMarkBadDecimals();

    address public immutable stockFeed;
    address public immutable stock;
    address public immutable usdgFeed;
    address public immutable usdg;
    address public immutable leasehold;

    uint256 private immutable stockFeedScale; // brings the stock feed answer to 18 decimals
    uint256 private immutable usdgFeedScale; // brings the USDG feed answer to 18 decimals
    uint256 private immutable shareUnit; // 10 ** leasehold decimals (credit mode)
    uint256 private immutable scale; // decimal adjustment folded into price()

    constructor(address stockFeed_, address stock_, address usdgFeed_, address usdg_, address leasehold_) {
        stockFeed = stockFeed_;
        stock = stock_;
        usdgFeed = usdgFeed_;
        usdg = usdg_;
        leasehold = leasehold_;

        uint8 sf = IOnixsFeed(stockFeed_).decimals();
        uint8 uf = IOnixsFeed(usdgFeed_).decimals();
        if (sf > 18 || uf > 18) revert OnixsMarkBadDecimals();
        stockFeedScale = 10 ** (18 - sf);
        usdgFeedScale = 10 ** (18 - uf);

        uint256 stockDec = IERC20Metadata(stock_).decimals();
        uint256 usdgDec = IERC20Metadata(usdg_).decimals();
        if (leasehold_ == address(0)) {
            // price = usdgUsd * 10^(36 + stockDec - usdgDec) / stockUsd
            if (36 + stockDec < usdgDec) revert OnixsMarkBadDecimals();
            shareUnit = 0;
            scale = 10 ** (36 + stockDec - usdgDec);
        } else {
            if (IERC4626(leasehold_).asset() != stock_) revert OnixsMarkBadDecimals();
            uint256 shareDec = IERC20Metadata(leasehold_).decimals();
            // price = A * stockUsd * 10^(36 + usdgDec - shareDec - stockDec) / usdgUsd, A = assets per whole share
            if (36 + usdgDec < shareDec + stockDec) revert OnixsMarkBadDecimals();
            shareUnit = 10 ** shareDec;
            scale = 10 ** (36 + usdgDec - shareDec - stockDec);
        }
    }

    /// @notice USD value of one whole raw stock token (1e18 raw units), 18 decimals.
    function stockUsd() public view returns (uint256) {
        (, int256 answer,,,) = IOnixsFeed(stockFeed).latestRoundData();
        if (answer <= 0) revert OnixsMarkBadAnswer();
        uint256 perShare = uint256(answer) * stockFeedScale;
        uint256 multiplier = 1e18;
        try IOnixsStockToken(stock).uiMultiplier() returns (uint256 m) {
            if (m != 0) multiplier = m;
        } catch {}
        return Math.mulDiv(perShare, multiplier, 1e18);
    }

    /// @notice USD value of one USDG, 18 decimals, never above $1.
    function usdgUsd() public view returns (uint256) {
        (, int256 answer,,,) = IOnixsFeed(usdgFeed).latestRoundData();
        if (answer <= 0) revert OnixsMarkBadAnswer();
        uint256 v = uint256(answer) * usdgFeedScale;
        return v > 1e18 ? 1e18 : v;
    }

    /// @notice When the stock feed last updated.
    function feedUpdatedAt() external view returns (uint256 updatedAt) {
        (,,, updatedAt,) = IOnixsFeed(stockFeed).latestRoundData();
    }

    /// @notice Morpho Blue IOracle.
    function price() external view returns (uint256) {
        if (leasehold == address(0)) {
            return Math.mulDiv(usdgUsd(), scale, stockUsd());
        }
        uint256 assetsPerShare = IERC4626(leasehold).convertToAssets(shareUnit);
        return Math.mulDiv(assetsPerShare * scale, stockUsd(), usdgUsd());
    }
}

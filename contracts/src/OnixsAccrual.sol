// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IOnixsMorpho, IOnixsRateModel, OnixsMarketParams, OnixsMarketState} from "./interfaces/IOnixsMorpho.sol";

/// @title OnixsAccrual
/// @notice Read-only interest accrual and share math that follows Morpho Blue's own rules, so a view can
///         show what a market holds right now without sending a transaction.
library OnixsAccrual {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant VIRTUAL_SHARES = 1e6;
    uint256 internal constant VIRTUAL_ASSETS = 1;

    function id(OnixsMarketParams memory p) internal pure returns (bytes32) {
        return keccak256(abi.encode(p));
    }

    function stateOf(IOnixsMorpho morpho, bytes32 marketId) internal view returns (OnixsMarketState memory m) {
        (m.totalSupplyAssets, m.totalSupplyShares, m.totalBorrowAssets, m.totalBorrowShares, m.lastUpdate, m.fee) =
            morpho.market(marketId);
    }

    /// @notice Market totals with interest accrued up to the current block (the same arithmetic Morpho runs).
    function accrued(IOnixsMorpho morpho, OnixsMarketParams memory p) internal view returns (OnixsMarketState memory m) {
        m = stateOf(morpho, id(p));
        uint256 elapsed = block.timestamp - m.lastUpdate;
        if (elapsed == 0 || m.totalBorrowAssets == 0 || p.irm == address(0) || m.lastUpdate == 0) return m;
        uint256 rate = IOnixsRateModel(p.irm).borrowRateView(p, m);
        uint256 interest = wMulDown(m.totalBorrowAssets, taylor(rate, elapsed));
        m.totalBorrowAssets += uint128(interest);
        m.totalSupplyAssets += uint128(interest);
        if (m.fee != 0) {
            uint256 feeAmount = wMulDown(interest, m.fee);
            uint256 feeShares = toSharesDown(feeAmount, m.totalSupplyAssets - feeAmount, m.totalSupplyShares);
            m.totalSupplyShares += uint128(feeShares);
        }
    }

    function taylor(uint256 x, uint256 n) internal pure returns (uint256) {
        uint256 first = x * n;
        uint256 second = mulDivDown(first, first, 2 * WAD);
        uint256 third = mulDivDown(second, first, 3 * WAD);
        return first + second + third;
    }

    function wMulDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / WAD;
    }

    function mulDivDown(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        return (x * y) / d;
    }

    function mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        return (x * y + (d - 1)) / d;
    }

    function toSharesDown(uint256 assets, uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        return mulDivDown(assets, totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
    }

    function toAssetsDown(uint256 shares, uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        return mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
    }

    function toAssetsUp(uint256 shares, uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
    }
}

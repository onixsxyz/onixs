// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The parameters that identify one Morpho Blue market. Its id is keccak256(abi.encode(params)).
struct OnixsMarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

/// @notice Market totals as Morpho Blue stores them.
struct OnixsMarketState {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint128 lastUpdate;
    uint128 fee;
}

/// @notice The subset of Morpho Blue used by ONIXS (written from the public Morpho Blue interface).
interface IOnixsMorpho {
    function createMarket(OnixsMarketParams memory marketParams) external;
    function isIrmEnabled(address irm) external view returns (bool);
    function isLltvEnabled(uint256 lltv) external view returns (bool);
    function idToMarketParams(bytes32 id)
        external
        view
        returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv);
    function market(bytes32 id)
        external
        view
        returns (
            uint128 totalSupplyAssets,
            uint128 totalSupplyShares,
            uint128 totalBorrowAssets,
            uint128 totalBorrowShares,
            uint128 lastUpdate,
            uint128 fee
        );
    function position(bytes32 id, address user)
        external
        view
        returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral);

    function accrueInterest(OnixsMarketParams memory marketParams) external;
    function supply(OnixsMarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data)
        external
        returns (uint256 assetsSupplied, uint256 sharesSupplied);
    function withdraw(OnixsMarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)
        external
        returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn);
    function borrow(OnixsMarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)
        external
        returns (uint256 assetsBorrowed, uint256 sharesBorrowed);
    function repay(OnixsMarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data)
        external
        returns (uint256 assetsRepaid, uint256 sharesRepaid);
    function supplyCollateral(OnixsMarketParams memory marketParams, uint256 assets, address onBehalf, bytes memory data) external;
    function withdrawCollateral(OnixsMarketParams memory marketParams, uint256 assets, address onBehalf, address receiver) external;
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
}

/// @notice Morpho Blue interest rate model view.
interface IOnixsRateModel {
    function borrowRateView(OnixsMarketParams memory marketParams, OnixsMarketState memory market) external view returns (uint256);
}

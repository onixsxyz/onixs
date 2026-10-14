// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OnixsCharter} from "../src/OnixsCharter.sol";
import {OnixsListing} from "../src/interfaces/IOnixsCharter.sol";
import {OnixsMarketParams} from "../src/interfaces/IOnixsMorpho.sol";

/// @dev Stands in for USDG and Morpho: the berth implementation's constructor reads USDG's decimals.
contract OnixsOwnerTestToken {
    function decimals() external pure returns (uint8) {
        return 6;
    }
}

/// @notice The charter owner is fixed at deployment and nothing can change it (offline unit tests).
contract OnixsCharterOwnerTest is Test {
    address internal constant OWNER = address(0xA11CE);
    OnixsCharter internal charter;

    address internal token;

    function setUp() public {
        token = address(new OnixsOwnerTestToken());
        charter = new OnixsCharter(OWNER, token, token, token);
    }

    function test_ownerIsTheConstructorArgument() public view {
        assertEq(charter.owner(), OWNER);
    }

    function test_zeroOwnerRefused() public {
        vm.expectRevert(OnixsCharter.OnixsCharterZeroOwner.selector);
        new OnixsCharter(address(0), token, token, token);
    }

    function test_noOwnershipTransferEntryPoints() public {
        bytes4[5] memory sels = [
            bytes4(keccak256("transferOwnership(address)")),
            bytes4(keccak256("acceptOwnership()")),
            bytes4(keccak256("renounceOwnership()")),
            bytes4(keccak256("pendingOwner()")),
            bytes4(keccak256("setOwner(address)"))
        ];
        for (uint256 i = 0; i < sels.length; i++) {
            vm.prank(OWNER);
            (bool ok,) = address(charter).call(abi.encodeWithSelector(sels[i], address(0xB0B)));
            assertFalse(ok, "an ownership entry point exists");
        }
        assertEq(charter.owner(), OWNER);
    }

    function test_onlyOwnerListsAndPauses() public {
        OnixsListing memory l;
        l.shortMarket = OnixsMarketParams(address(0), address(0), address(0), address(0), 0);
        l.creditMarket = l.shortMarket;
        vm.prank(address(0xB0B));
        vm.expectRevert(OnixsCharter.OnixsCharterNotOwner.selector);
        charter.list(l);
        vm.prank(address(0xB0B));
        vm.expectRevert(OnixsCharter.OnixsCharterNotOwner.selector);
        charter.setPaused(0, true);
    }
}

// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

contract Reverter {
    error ConformanceError(uint256 code);

    uint256 public sink;

    function revertWithReason() external pure {
        require(false, "conformance: reason");
    }

    function revertWithCustomError() external pure {
        revert ConformanceError(42);
    }

    function panic() external pure returns (uint256) {
        uint256 zero = 0;
        return uint256(1) / zero;
    }

    // Writes storage each pass so the optimizer cannot drop the loop.
    function burnGas() external {
        uint256 i;
        while (true) {
            sink = ++i;
        }
    }

    function revertBare() external pure {
        revert();
    }
}

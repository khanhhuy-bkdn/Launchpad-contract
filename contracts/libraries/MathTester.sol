//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "./Formula.sol";

contract MathTester {
    function pow(uint256 x, uint256 y) external pure returns (uint256) {
        return Formula.pow(x, y);
    }
}

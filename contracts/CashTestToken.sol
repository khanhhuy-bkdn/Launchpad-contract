// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./libraries/Config.sol";

contract CashTestToken is ERC20 {
    constructor(address[] memory acc) public ERC20("USD Test Token", "USD") {
        for (uint256 i = 0; i < acc.length; i++) {
            _mint(acc[i], 100000000 * Constant.FIXED_POINT);
        }
    }

    function mint(address account) public {
        _mint(account, 100000000 * Constant.FIXED_POINT);
    }
}

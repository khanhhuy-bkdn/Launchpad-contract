// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenGMI is ERC20, Ownable {
    // a mapping from an address to whether or not it can mint / burn
    mapping(address => bool) controllers;

    constructor() ERC20("Gamifi Token", "GMI") { }

    /**
    * mints GMI to a recipient
    * @param to the recipient of the GMI
    * @param amount the amount of GMI to mint
    */
    function mint(address to, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can mint");
        _mint(to, amount);
    }

    function stakeMint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
    * burns GMI from a holder
    * @param from the holder of the GMI
    * @param amount the amount of GMI to burn
    */
    function burn(address from, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can burn");
        _burn(from, amount);
    }

    /**
    * enables an address to mint / burn
    * @param controller the address to enable
    */
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }

    /**
    * disables an address from minting / burning
    * @param controller the address to disbale
    */
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
    }
}
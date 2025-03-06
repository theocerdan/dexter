// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract DumbERC20 is ERC20 {

    constructor(string memory name, string memory symbol) ERC20(name, symbol){
    }

    function mint(address account, uint amount) public {
        _mint(account, amount);
    }
}

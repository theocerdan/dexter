// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import "./Pair.sol";
import { IUniswapV2Router02 } from "./interfaces/IUniswapV2Router02.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Router {

    using SafeERC20 for IERC20;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    address public uniswapV2Router;

    event NewPair(address tokenA, address tokenB, address pair);

    constructor(address _uniswapV2Router) {
        uniswapV2Router = _uniswapV2Router;
    }

    function createPair(address tokenA, address tokenB) external {
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'PAIR_EXISTS');

        address pair = address(new Pair(token0, token1));

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit NewPair(tokenA, tokenB, pair);
    }


    function swapForwarding(uint256 amountIn, address tokenIn, address tokenOut, uint256 deadline) external payable {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(this.uniswapV2Router(), amountIn);
        require(msg.value == 1 ether, 'The fees is 1 ETH');

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IUniswapV2Router02(this.uniswapV2Router()).swapExactTokensForTokens(amountIn, 0, path, msg.sender, deadline);
    }
}
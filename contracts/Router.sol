// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./Pair.sol";
import {IUniswapV2Router02} from "./interfaces/IUniswapV2Router02.sol";

contract Router {

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    address public uniswapV2Router;

    event NewPair(address tokenA, address tokenB, address pair);

    constructor() {
        uniswapV2Router = address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    }

    function createPair(address tokenA, address tokenB) external returns (address){
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'PAIR_EXISTS');

        address pair = address(new Pair(token0, token1));

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit NewPair(tokenA, tokenB, pair);
        return pair;
    }

    function swapForwarding(uint256 amountIn, address tokenIn, address tokenOut, uint256 deadline) external payable {
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), 'transferFrom failed.');
        require(IERC20(tokenIn).approve(this.uniswapV2Router(), amountIn), 'approve failed.');
        require(msg.value == 1 ether, 'The fees is 1 ETH');

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IUniswapV2Router02(this.uniswapV2Router()).swapExactTokensForTokens(amountIn, 0, path, msg.sender, deadline);
    }
}
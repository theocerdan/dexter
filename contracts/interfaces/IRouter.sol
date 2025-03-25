// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IRouter {

    function owner() external view returns (address);
    function uniswapV2Router() external view returns (address);
    function getPair(address, address) external view returns (address); //je me demande si ça fonctionne comme ca pour les mappings

    event NewPair(address tokenA, address tokenB, address pair);

    error Unauthorized(address sender, address owner);
    error WithdrawFailed();
    error UnsufficientEther(uint256 value, uint256 expected);
    error PairAlreadyExist();
    error IdenticalAddress();
    error ZeroAddress();

    function createPair(address tokenA, address tokenB) external;
    function swap(uint256 amountIn, address tokenIn, address tokenOut, uint256 minAmountOut) external payable;
    function withdrawFees() external;

}
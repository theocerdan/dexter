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
    address immutable public uniswapV2Router;
    address immutable public owner;

    event NewPair(address tokenA, address tokenB, address pair);

    error Unauthorized(address sender, address owner);
    error UnsufficientEther(uint256 value, uint256 expected);
    error PairAlreadyExist();
    error IdenticalPairAddress(address addressA, address addressB);
    error ZeroPairAddress();

    constructor(address _uniswapV2Router) {
        uniswapV2Router = _uniswapV2Router;
        owner = msg.sender;
    }

    function createPair(address tokenA, address tokenB) external {
        if (tokenA == tokenB) revert IdenticalPairAddress(tokenA, tokenB);
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (token0 == address(0)) revert ZeroPairAddress();
        if (getPair[token0][token1] != address(0)) revert PairAlreadyExist();

        address pair = address(new Pair(token0, token1));

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit NewPair(tokenA, tokenB, pair);
    }


    function swapForwarding(uint256 amountIn, address tokenIn, address tokenOut, uint256 deadline) external payable {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(this.uniswapV2Router(), amountIn);
        if (msg.value != 1 ether) revert UnsufficientEther(msg.value, 1 ether);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IUniswapV2Router02(this.uniswapV2Router()).swapExactTokensForTokens(amountIn, 0, path, msg.sender, deadline);
    }

    function withdrawFees() external {
        if (msg.sender != owner) revert Unauthorized(msg.sender, owner);
        payable(owner).transfer(address(this).balance);
    }
}
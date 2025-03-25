// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {DexterPool} from "./DexterPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDexterManager} from "./interfaces/IDexterManager.sol";
import {IUniswapV2Router02} from "./interfaces/IUniswapV2Router02.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DexterManager is IDexterManager {

    using SafeERC20 for IERC20;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    address immutable public uniswapV2Router;
    address immutable public owner;

    constructor(address _uniswapV2Router) {
        uniswapV2Router = _uniswapV2Router;
        owner = msg.sender;
    }

    function createPair(address tokenA, address tokenB) external {
        if (tokenA == tokenB) revert IdenticalAddress();
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (token0 == address(0)) revert ZeroAddress();
        if (getPair[token0][token1] != address(0)) revert PairAlreadyExist();

        address pair = address(new DexterPool(token0, token1));

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit NewPair(tokenA, tokenB, pair);
    }

    function swap(uint256 amountIn, address tokenIn, address tokenOut, uint256 minAmountOut) external payable {
        address pair = getPair[tokenIn][tokenOut];

        if (pair == address(0)) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenIn).safeIncreaseAllowance(this.uniswapV2Router(), amountIn);
            if (msg.value != 1 ether) revert UnsufficientEther(msg.value, 1 ether);

            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            IUniswapV2Router02(this.uniswapV2Router()).swapExactTokensForTokens(amountIn, 0, path, msg.sender, block.timestamp + 1);
            return;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, pair, amountIn);
        DexterPool(pair).swap(tokenIn, minAmountOut, msg.sender);
    }

    function withdrawFees() external {
        if (msg.sender != owner) revert Unauthorized(msg.sender, owner);
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        if (!sent) revert WithdrawFailed();
    }

}
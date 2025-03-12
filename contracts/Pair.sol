// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract Pair {

    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalFeesA;
    uint256 public totalFeesB;
    mapping(address => uint256) public shares;
    uint256 public totalShares;


    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Transfer failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Transfer failed");

        uint256 newShares;
        if (totalShares == 0) {
            newShares = Math.sqrt(amountA * amountB);
        } else {
            newShares =  Math.min(
                (amountA * totalShares) / reserveA,
                (amountB * totalShares) / reserveB
            );
        }

        require(newShares > 0, "Insufficient liquidity provided");

        reserveA += amountA;
        reserveB += amountB;
        totalShares += newShares;
        shares[msg.sender] += newShares;
    }

    function removeLiquidity(uint256 liquidity) external {
        require(shares[msg.sender] >= liquidity, "Insufficient liquidity");

        uint256 amountA = (liquidity * reserveA) / totalShares;
        uint256 amountB = (liquidity * reserveB) / totalShares;

        require(IERC20(tokenA).transfer(msg.sender, amountA), "Transfer failed");
        require(IERC20(tokenB).transfer(msg.sender, amountB), "Transfer failed");

        reserveA -= amountA;
        reserveB -= amountB;
        totalShares -= liquidity;
        shares[msg.sender] -= liquidity;

        console.log("Removing liquidity from pair");
    }

    function swap(address tokenIn, uint256 amountIn) external {
        require(tokenIn == tokenA || tokenIn == tokenB, "Invalid input token");
        if (tokenIn == tokenA) {
            swapTokenAToTokenB(amountIn);
        } else if (tokenIn == tokenB){
            swapTokenBToTokenA(amountIn);
        }
    }


    function swapTokenAToTokenB(uint256 amountIn) internal {
        require(amountIn > 0, "Invalid input amount");
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountIn), "Transfer failed");

        (uint256 amountOut, uint256 fee) = getAmountOut(amountIn, reserveA, reserveB);
        require(amountOut > 0, "Insufficient output amount");
        require(IERC20(tokenB).transfer(msg.sender, amountOut), "Transfer failed");

        totalFeesB += fee;

        reserveA += amountIn;
        reserveB -= amountOut;

        console.log("Swapped %s TokenA for %s TokenB (%s fees)", amountIn, amountOut, fee);
    }

    function swapTokenBToTokenA(uint256 amountIn) internal {
        require(amountIn > 0, "Invalid input amount");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountIn), "Transfer failed");

        (uint256 amountOut, uint256 fee) = getAmountOut(amountIn, reserveB, reserveA);
        require(amountOut > 0, "Insufficient output amount");
        require(IERC20(tokenA).transfer(msg.sender, amountOut), "Transfer failed");

        totalFeesA += fee;

        reserveB += amountIn;
        reserveA -= amountOut;

        console.log("Swapped %s TokenB for %s TokenA (%s fees)", amountIn, amountOut, fee);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut, uint256 feeOut) {
        require(amountIn > 0, "Amount in must be greater than zero");
        require(reserveIn > 0 && reserveOut > 0, "Reserves must be greater than zero");

        // Uniswap V2 formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);

        // Fee calculation: assuming a 0.10% fee (Uniswap V2 standard)
        feeOut = (amountOut * 10) / 1000;

        return (amountOut - feeOut, feeOut);
    }

    function getQuote(address tokenIn, uint256 amountIn) external view returns (uint256){
        require(tokenIn == tokenA || tokenIn == tokenB, 'INVALID_TOKEN_IN');

        if (tokenIn == tokenA) {
            (uint256 amountOut, ) = getAmountOut(amountIn, reserveA, reserveB);
            return amountOut;
        } else {
            (uint256 amountOut, ) = getAmountOut(amountIn, reserveB, reserveA);
            return amountOut;
        }
    }

}


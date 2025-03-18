// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Pair {

    using SafeERC20 for IERC20;

    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    mapping(address => uint256) public shares;
    uint256 public totalShares;


    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != _tokenB, "Tokens must be different");
        require(_tokenA != address(0), "Invalid token address");
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

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
        require(shares[msg.sender] >= liquidity, "Insufficient shares");

        uint256 amountA = (liquidity * reserveA) / totalShares;
        uint256 amountB = (liquidity * reserveB) / totalShares;

        reserveA -= amountA;
        reserveB -= amountB;
        totalShares -= liquidity;
        shares[msg.sender] -= liquidity;

        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);
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
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = getAmountOut(amountIn, reserveA, reserveB);
        require(amountOut > 0, "Insufficient output amount");

        reserveA += amountIn;
        reserveB -= amountOut;

        IERC20(tokenB).safeTransfer(msg.sender, amountOut);
    }

    function swapTokenBToTokenA(uint256 amountIn) internal {
        require(amountIn > 0, "Invalid input amount");
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = getAmountOut(amountIn, reserveB, reserveA);
        require(amountOut > 0, "Insufficient output amount");

        reserveB += amountIn;
        reserveA -= amountOut;

        IERC20(tokenA).safeTransfer(msg.sender, amountOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "Amount in must be greater than zero");
        require(reserveIn > 0 && reserveOut > 0, "Reserves must be greater than zero");

        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);

        return (amountOut);
    }

    function getQuote(address tokenIn, uint256 amountIn) external view returns (uint256){
        require(tokenIn == tokenA || tokenIn == tokenB, 'INVALID_TOKEN_IN');

        if (tokenIn == tokenA) {
            return getAmountOut(amountIn, reserveA, reserveB);
        } else {
            return getAmountOut(amountIn, reserveB, reserveA);
        }
    }

}


// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IPair} from "./interfaces/IPair.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Pair is IPair {

    using SafeERC20 for IERC20;

    address immutable public tokenA;
    address immutable public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(address _tokenA, address _tokenB) {
        if (_tokenA == _tokenB) revert IdenticalAddress();
        if (_tokenA == address(0)) revert ZeroAddress();
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        uint256 newShares;
        uint256 totalShares_ = totalShares;
        if (totalShares_ == 0) {
            newShares = Math.sqrt(amountA * amountB);
        } else {
            newShares =  Math.min(
                (amountA * totalShares_) / reserveA,
                (amountB * totalShares_) / reserveB
            );
        }

        if (newShares <= 0) revert NotEnoughLiquidityProvided();

        reserveA += amountA;
        reserveB += amountB;
        totalShares += newShares;
        shares[msg.sender] += newShares;

        emit AddLiquidity(msg.sender, amountA, amountB, newShares);
    }

    function removeLiquidity(uint256 liquidity) external {
        if (shares[msg.sender] < liquidity) revert NotEnoughShares();

        uint256 amountA = (liquidity * reserveA) / totalShares;
        uint256 amountB = (liquidity * reserveB) / totalShares;

        reserveA -= amountA;
        reserveB -= amountB;
        totalShares -= liquidity;
        shares[msg.sender] -= liquidity;

        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);

        emit RemoveLiquidity(msg.sender, liquidity, amountA, amountB);
    }

    function swap(address tokenIn, uint256 amountIn) external {
        if (tokenIn != tokenA && tokenIn != tokenB) revert InvalidInputToken();

        if (tokenIn == tokenA) {
            swapTokenAToTokenB(amountIn);
        } else if (tokenIn == tokenB){
            swapTokenBToTokenA(amountIn);
        }
    }


    function swapTokenAToTokenB(uint256 amountIn) private {
        if (amountIn <= 0) revert InvalidInputAmount();
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = getAmountOut(amountIn, reserveA, reserveB);
        if (amountOut <= 0) revert InvalidOutputAmount();

        reserveA += amountIn;
        reserveB -= amountOut;

        IERC20(tokenB).safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, tokenA, tokenB, amountIn, amountOut);
    }

    function swapTokenBToTokenA(uint256 amountIn) private {
        if (amountIn <= 0) revert InvalidInputAmount();
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = getAmountOut(amountIn, reserveB, reserveA);
        if (amountOut <= 0) revert InvalidOutputAmount();

        reserveB += amountIn;
        reserveA -= amountOut;

        IERC20(tokenA).safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, tokenB, tokenA, amountIn, amountOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256 amountOut) {
        if (amountIn <= 0) revert InvalidInputAmount();
        if (reserveIn <= 0 && reserveOut <= 0) revert NotEnoughReserve();

        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;

        return (numerator / denominator);
    }

    function getQuote(address tokenIn, uint256 amountIn) external view returns (uint256){
        if (tokenIn != tokenA && tokenIn != tokenB) revert InvalidInputToken();

        if (tokenIn == tokenA) {
            return getAmountOut(amountIn, reserveA, reserveB);
        } else {
            return getAmountOut(amountIn, reserveB, reserveA);
        }
    }

}


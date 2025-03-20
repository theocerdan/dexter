// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

interface IPair {

    function tokenA() external view returns (address);
    function tokenB() external view returns (address);

    function reserveA() external view returns (uint256);
    function reserveB() external view returns (uint256);
    function totalShares() external view returns (uint256);
    function shares(address key) external view returns (uint256); //je me demande si ça fonctionne comme ca pour les mappings

    event AddLiquidity(address sender, uint256 amountA, uint256 amountB);
    event RemoveLiquidity(address sender, uint256 shares);
    event Swap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    error IdenticalAddress();
    error ZeroAddress();
    error NotEnoughLiquidityProvided();
    error NotEnoughShares();
    error NotEnoughReserve();

    error InvalidInputToken();
    error InvalidInputAmount();
    error InvalidOutputAmount();

    function addLiquidity(uint256 amountA, uint256 amountB) external;
    function removeLiquidity(uint256 liquidity) external;
    function swap(address tokenIn, uint256 amountIn) external;
    function getQuote(address tokenIn, uint256 amountIn) external view returns (uint256);

}
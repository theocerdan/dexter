// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./Pair.sol";

contract Router {

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event NewPair(address tokenA, address tokenB, address pair);

    constructor() {}

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
}
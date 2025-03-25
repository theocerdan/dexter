import hre, {ethers} from "hardhat";
import {DexterManager, DexterPool, DumbERC20} from "../typechain-types";
import {Addressable} from "ethers";
import {expect} from "chai";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {UNISWAP_V2_ROUTER_ADDRESS} from "./Constants";


function simulateQuote(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
    expect(amountIn > 0n, "Amount in must be greater than zero");
    expect(reserveIn > 0n && reserveOut > 0n, "Reserves must be greater than zero");

    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;

    return { amountOut: numerator / denominator };
}

async function getSigners() {
    return await ethers.getSigners()
}

async function createTokens(airdropUsers: Addressable[], airdropAmount: number[]) {
    const feeData = await hre.ethers.provider.getFeeData();

    const tokenA = await hre.ethers.deployContract("DumbERC20", ["TokenA", "TKA"], { gasPrice: feeData.gasPrice });
    const tokenB = await hre.ethers.deployContract("DumbERC20", ["TokenB", "TKB"], { gasPrice: feeData.gasPrice });

    for (const user of airdropUsers) {
        const index = airdropUsers.indexOf(user);
        let amount = airdropAmount[index];
        if (amount == -1) {
            amount = 1000;
        }
        await tokenA.mint(user, amount);
        await tokenB.mint(user, amount);
    }

    return { tokenA, tokenB, addressTokenA: tokenA.getAddress(), addressTokenB: tokenB.getAddress() };
}

async function createManager() {

    const feeData = await hre.ethers.provider.getFeeData();

    const router = await hre.ethers.deployContract("DexterManager", [UNISWAP_V2_ROUTER_ADDRESS], { gasPrice: feeData.gasPrice });

    return { router };
}

async function createPool(router: DexterManager, tokenA: DumbERC20, tokenB: DumbERC20) {
    const tokenAAddress = await tokenA.getAddress();
    const tokenBAddress = await tokenB.getAddress();

    await router.createPair(tokenAAddress, tokenBAddress);

    const events = await router.queryFilter(router.filters.NewPair());

    const rightPairAddress = events.filter((e: { args: { tokenA: string; tokenB: string; }; }) => {
        return e.args.tokenA == tokenAAddress || tokenBAddress && e.args.tokenB == tokenAAddress || tokenBAddress;
    })

    expect(rightPairAddress.length).to.be.equal(1);

    const pair = await ethers.getContractAt("DexterPool", rightPairAddress[0].args.pair);
    const pairTokenA = await ethers.getContractAt("DumbERC20", await pair.tokenA());
    const pairTokenB = await ethers.getContractAt("DumbERC20", await pair.tokenB());

    return { pair, pairTokenA: pairTokenA, pairTokenB: pairTokenB };
}

async function depositLiquidity(pair: DexterPool, tokenA: DumbERC20, tokenB: DumbERC20, amountA: number, amountB: number, who?: SignerWithAddress) {
    const accounts = await ethers.getSigners();
    let account = who == undefined ? accounts[0] : who;

    const pairAddress = await pair.getAddress();

    await tokenA.connect(account).approve(pairAddress, 100_000_000_000);
    await tokenB.connect(account).approve(pairAddress, 100_000_000_000);

    if (await pair.tokenA() == await tokenA.getAddress()) {
        await pair.connect(account).addLiquidity(amountA, amountB);
    } else {
        await pair.connect(account).addLiquidity(amountB, amountA);
    }
}


export { simulateQuote, getSigners, createTokens, createManager, createPool, depositLiquidity };
import hre, {ethers} from "hardhat";
import {DumbERC20, Pair, Router} from "../typechain-types";
import {Addressable, AddressLike, ZeroAddress} from "ethers";
import {expect} from "chai";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Router contract", function () {

  async function simulateQuote(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
    expect(amountIn > 0n, "Amount in must be greater than zero");
    expect(reserveIn > 0n && reserveOut > 0n, "Reserves must be greater than zero");

    // Uniswap V2 formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);

    // Fee calculation: assuming a 0.10% fee (Uniswap V2 standard)
    const feeOut = (amountOut * 10n) / 1000n;

    return { amountOut: amountOut - feeOut, feeOut };
  }

  async function getSigners() {
    return await ethers.getSigners()
  }

  async function createTokens(airdropUsers: Addressable[], airdropAmount: number[]) {

    const tokenA = await hre.ethers.deployContract("DumbERC20", ["TokenA", "TKA"]);
    const tokenB = await hre.ethers.deployContract("DumbERC20", ["TokenB", "TKB"]);

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

  async function createRouter() {

    const router = await hre.ethers.deployContract("Router");

    return { router };
  }

  async function createPair(router: Router, tokenA: DumbERC20, tokenB: DumbERC20) {
    const tokenAAddress = await tokenA.getAddress();
    const tokenBAddress = await tokenB.getAddress();

    await router.createPair(tokenAAddress, tokenBAddress);

    const events = await router.queryFilter(router.filters.NewPair());

    const rightPairAddress = events.filter((e) => {
        return e.args.tokenA == tokenAAddress || tokenBAddress && e.args.tokenB == tokenAAddress || tokenBAddress;
    })

    expect(rightPairAddress.length).to.be.equal(1);

    const pair = await ethers.getContractAt("Pair", rightPairAddress[0].args.pair);
    const pairTokenA = await ethers.getContractAt("DumbERC20", await pair.tokenA());
    const pairTokenB = await ethers.getContractAt("DumbERC20", await pair.tokenB());

    return { pair, pairTokenA: pairTokenA, pairTokenB: pairTokenB };
  }

  async function depositLiquidity(pair: Pair, tokenA: DumbERC20, tokenB: DumbERC20, amountA: number, amountB: number) {
    const pairAddress = await pair.getAddress();

    await tokenA.approve(pairAddress, 100_000_000_000);
    await tokenB.approve(pairAddress, 100_000_000_000);

    if (await pair.tokenA() == await tokenA.getAddress()) {
      await pair.addLiquidity(amountA, amountB);
    } else {
      await pair.addLiquidity(amountB, amountA);
    }
  }

  before(async () => {
    //[owner, toto] = await ethers.getSigners();
  })

  it("Deploy Router contract", async () => {
    await createRouter();
  })

  it("Create pair", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();

    const { pair } = await createPair(router, tokenA, tokenB);

    expect(await pair.tokenA() == await tokenA.getAddress() || await tokenB.getAddress());
    expect(await pair.tokenB() == await tokenA.getAddress() || await tokenB.getAddress());

    expect(await pair.reserveB()).to.be.equal(0);
    expect(await pair.reserveA()).to.be.equal(0);
    expect(await pair.totalShares()).to.be.equal(0);
    expect(await pair.totalFeesA()).to.be.equal(0);
    expect(await pair.totalFeesB()).to.be.equal(0);
  });

  it("Create pair with zero address", async () => {
    const { tokenA } = await createTokens([], []);
    const { router } = await createRouter();

    await expect(router.createPair(tokenA.getAddress(), ZeroAddress)).to.be.revertedWith("ZERO_ADDRESS");
  });

  it("Create pair with identical addresses", async () => {
    const { tokenA } = await createTokens([], []);
    const { router } = await createRouter();

    await expect(router.createPair(tokenA.getAddress(), tokenA.getAddress())).to.be.revertedWith("IDENTICAL_ADDRESSES");
  });

  it("Create already existing pair ", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();

    await router.createPair(tokenA.getAddress(), tokenB.getAddress());
    await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.be.revertedWith("PAIR_EXISTS");
  });

  it("Pair exist in the route table (getPair)", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();
    const { pair } = await createPair(router, tokenA, tokenB);

    const pairAddress = await router.getPair(tokenA.getAddress(), tokenB.getAddress());
    const pairAddressReverse = await router.getPair(tokenB.getAddress(), tokenA.getAddress());

    expect(pairAddress).to.be.equal(await pair.getAddress());
    expect(pairAddressReverse).to.be.equal(await pair.getAddress());
  });

  it("Router should emit an event when new pair is created", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();

    await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.emit(router, "NewPair").withArgs(tokenA.getAddress(), tokenB.getAddress(), anyValue);
  });

  it("Try to get non existing pair", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();

    expect(await router.getPair(tokenA.getAddress(), tokenB.getAddress())).to.be.equal(ZeroAddress);
  });

});
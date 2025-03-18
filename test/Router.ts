import hre, {ethers} from "hardhat";
import {DumbERC20, Router} from "../typechain-types";
import {Addressable, parseEther, ZeroAddress} from "ethers";
import {expect} from "chai";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {UNISWAP_V2_ROUTER_ADDRESS} from "./Constants";

describe("Router contract", function () {

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

    const router = await hre.ethers.deployContract("Router", [UNISWAP_V2_ROUTER_ADDRESS]);

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

  it('should forward a swap through uniswap v2', async () => {
      const { router } = await createRouter();

      const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

      const vbAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

      const vbSigner = await ethers.getImpersonatedSigner(vbAddress);

      const weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
      const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

      const bal_weth_before = await weth.balanceOf(await vbSigner.getAddress());
      const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());
      const bal_eth_before = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

      await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
      await router.connect(vbSigner).swapForwarding(bal_usdt_before, USDT_ADDRESS, WETH_ADDRESS, 100000000000n, { value: parseEther("1.0")});

      const bal_weth_after = await weth.balanceOf(await vbSigner.getAddress());
      const bal_usdt_after = await usdt.balanceOf(await vbSigner.getAddress());
      const bal_eth_after = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

      expect(bal_weth_after).to.be.gt(bal_weth_before);
      expect(bal_usdt_after).to.be.lt(bal_usdt_before);
      expect(bal_eth_after).to.be.lt(bal_eth_before);
  });

    it('should forward a swap through uniswap v2 but user didn\t have enought ustd', async () => {
        const { router } = await createRouter();

        const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

        const vbAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        const vbSigner = await ethers.getImpersonatedSigner(vbAddress);

        const weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
        const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

        const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

        await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
        await expect(router.connect(vbSigner).swapForwarding(bal_usdt_before + 100n, USDT_ADDRESS, WETH_ADDRESS, 100000000000n, { value: parseEther("1.0")})).to.be.revertedWithoutReason();
    });

});
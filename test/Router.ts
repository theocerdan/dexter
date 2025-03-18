import hre, {ethers} from "hardhat";
import {DumbERC20, Router} from "../typechain-types";
import {Addressable, parseEther, ZeroAddress} from "ethers";
import {expect} from "chai";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {UNISWAP_V2_ROUTER_ADDRESS} from "./Constants";
import {getSigners} from "@nomicfoundation/hardhat-ethers/internal/helpers";

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
  });

  it("Create pair with zero address", async () => {
    const { tokenA } = await createTokens([], []);
    const { router } = await createRouter();

    await expect(router.createPair(tokenA.getAddress(), ZeroAddress)).to.be.revertedWith("Invalid token address");
  });

  it("Create pair with identical addresses", async () => {
    const { tokenA } = await createTokens([], []);
    const { router } = await createRouter();

    await expect(router.createPair(tokenA.getAddress(), tokenA.getAddress())).to.be.revertedWith("Address must be different");
  });

  it("Create already existing pair ", async () => {
    const { tokenA, tokenB } = await createTokens([], []);
    const { router } = await createRouter();

    await router.createPair(tokenA.getAddress(), tokenB.getAddress());
    await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.be.revertedWith("This pair already exists");
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
      await router.connect(vbSigner).swapForwarding(1000, USDT_ADDRESS, WETH_ADDRESS, 100000000000n, { value: parseEther("1.0")});

      const bal_weth_after = await weth.balanceOf(await vbSigner.getAddress());
      const bal_usdt_after = await usdt.balanceOf(await vbSigner.getAddress());
      const bal_eth_after = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

      expect(bal_weth_after).to.be.gt(bal_weth_before);
      expect(bal_usdt_after).to.be.lt(bal_usdt_before);
      expect(bal_eth_after).to.be.lt(bal_eth_before);
  });

    it('should take a fees for forwarding', async () => {
        const { router } = await createRouter();

        const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

        const vbAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        const vbSigner = await ethers.getImpersonatedSigner(vbAddress);

        const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

        const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

        await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);

        const bal_eth_before = await hre.ethers.provider.getBalance(await router.getAddress());
        await router.connect(vbSigner).swapForwarding(1000, USDT_ADDRESS, WETH_ADDRESS, 100000000000n, { value: parseEther("1.0")});

        const bal_eth_after = await hre.ethers.provider.getBalance(await router.getAddress());

        expect(bal_eth_before).to.be.equal(0);
        expect(bal_eth_after).to.be.equal(ethers.parseEther("1.0"));
    });

    it('only can owner withdraw collected fees', async () => {
        const { router } = await createRouter();
        const [ toto ] = await getSigners(hre);

        const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

        const vbAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        const vbSigner = await ethers.getImpersonatedSigner(vbAddress);

        const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

        const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

        await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);

        const bal_eth_before = await hre.ethers.provider.getBalance(await router.getAddress());

        await router.connect(vbSigner).swapForwarding(1000, USDT_ADDRESS, WETH_ADDRESS, 100000000000n, { value: parseEther("1.0")});

        const bal_eth_after = await hre.ethers.provider.getBalance(await router.getAddress());

        expect(bal_eth_before).to.be.equal(0);
        expect(bal_eth_after).to.be.equal(ethers.parseEther("1.0"));

        await expect(router.connect(vbSigner).withdrawFees()).to.be.revertedWith("You are not the owner");

        const bal_eth_owner_before_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());
        await router.withdrawFees();

        const bal_eth_after_withdraw = await hre.ethers.provider.getBalance(await router.getAddress());

        const bal_eth_owner_after_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());
        expect(bal_eth_after_withdraw).to.be.equal(0);
        expect(bal_eth_owner_after_withdraw).to.be.greaterThan(bal_eth_owner_before_withdraw);
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
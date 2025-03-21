import hre, {ethers} from "hardhat";
import {DumbERC20, Pair, Router} from "../typechain-types";
import {Addressable, parseEther, ZeroAddress} from "ethers";
import {expect} from "chai";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {UNISWAP_V2_ROUTER_ADDRESS} from "./Constants";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("Router contract", function () {
    function simulateQuote(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
        expect(amountIn > 0n, "Amount in must be greater than zero");
        expect(reserveIn > 0n && reserveOut > 0n, "Reserves must be greater than zero");

        const amountInWithFee = amountIn * 997n;
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn * 1000n + amountInWithFee;

        return { amountOut: numerator / denominator };
    }
    async function depositLiquidity(pair: Pair, tokenA: DumbERC20, tokenB: DumbERC20, amountA: number, amountB: number, who?: SignerWithAddress) {
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

  async function createRouter() {

    const feeData = await hre.ethers.provider.getFeeData();

    const router = await hre.ethers.deployContract("Router", [UNISWAP_V2_ROUTER_ADDRESS], { gasPrice: feeData.gasPrice });

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

  it("should deploy Router Contract", async () => {
    await createRouter();
  })

    describe("Pair", function () {
        it("should create Pair", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createRouter();

            const { pair } = await createPair(router, tokenA, tokenB);

            expect(await pair.tokenA() == await tokenA.getAddress() || await tokenB.getAddress());
            expect(await pair.tokenB() == await tokenA.getAddress() || await tokenB.getAddress());

            expect(await pair.reserveB()).to.be.equal(0);
            expect(await pair.reserveA()).to.be.equal(0);
            expect(await pair.totalShares()).to.be.equal(0);
        });

        it("should revert custom error if token address is zero", async () => {
            const { tokenA } = await createTokens([], []);
            const { router } = await createRouter();

            await expect(router.createPair(tokenA.getAddress(), ZeroAddress)).to.be.revertedWithCustomError(router, "ZeroAddress")
        });

        it("should revert custom error if token address are identical", async () => {
            const { tokenA } = await createTokens([], []);
            const { router } = await createRouter();

            await expect(router.createPair(tokenA.getAddress(), tokenA.getAddress())).to.be.revertedWithCustomError(router, "IdenticalAddress");
        });

        it("should revert custom error if pair already exist", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createRouter();

            await router.createPair(tokenA.getAddress(), tokenB.getAddress());
            await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.be.revertedWithCustomError(router, "PairAlreadyExist");
        });

        it("should return pair address by using getPair() function", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createRouter();
            const { pair } = await createPair(router, tokenA, tokenB);

            const pairAddress = await router.getPair(tokenA.getAddress(), tokenB.getAddress());
            const pairAddressReverse = await router.getPair(tokenB.getAddress(), tokenA.getAddress());

            expect(pairAddress).to.be.equal(await pair.getAddress());
            expect(pairAddressReverse).to.be.equal(await pair.getAddress());
        });

        it("should emit event when new pair is created", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createRouter();

            await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.emit(router, "NewPair").withArgs(tokenA.getAddress(), tokenB.getAddress(), anyValue);
        });

        it("should return zero address if pair isn't exist", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createRouter();

            expect(await router.getPair(tokenA.getAddress(), tokenB.getAddress())).to.be.equal(ZeroAddress);
        });

    });

  describe("Withdraw fees", function () {
      it('should not be possible to withdraw fees if you are not the owner', async () => {
          const { router } = await createRouter();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          await usdt.connect(vbSigner).approve(await router.getAddress(), 1000);

          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, { value: parseEther("1.0")});

          await expect(router.connect(vbSigner).withdrawFees()).to.be.revertedWithCustomError(router, "Unauthorized");
      });

      it('should be possible to withdraw fees if you are the owner', async () => {
          const { router } = await createRouter();
          const [ toto ] = await getSigners();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          await usdt.connect(vbSigner).approve(await router.getAddress(), 1000);

          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, { value: parseEther("1.0")});

          const bal_eth_owner_before_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());

          await router.withdrawFees();

          const bal_eth_after_withdraw = await hre.ethers.provider.getBalance(await router.getAddress());

          const bal_eth_owner_after_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());

          expect(bal_eth_after_withdraw).to.be.equal(0);
          expect(bal_eth_owner_after_withdraw).to.be.greaterThan(bal_eth_owner_before_withdraw);
      });


  });

  describe("Swap", function () {

      it("should swap tokens through the router if the pair exist", async () => {
          const [ toto ] = await ethers.getSigners();

          const { tokenA, tokenB } = await createTokens([toto], [1000, 1000]);

          const { router } = await createRouter();

          const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

          await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

          await pairTokenA.approve(await router.getAddress(), 100);
          await router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress());

          const { amountOut: simulateAmountOut } = simulateQuote(100n, 500n, 500n);
          expect(await pair.reserveB()).to.be.equal(500n - simulateAmountOut);
          expect(await pair.reserveA()).to.be.equal(500n + 100n);

          expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(1000n - 500n - 100n);
          expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(1000n - 500n + simulateAmountOut);
      })

      it('should forward a swap through uniswap v2 if the pair doesn\' t exist', async () => {
          const { router } = await createRouter();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_weth_before = await weth.balanceOf(await vbSigner.getAddress());
          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());
          const bal_eth_before = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, { value: parseEther("1.0")});

          const bal_weth_after = await weth.balanceOf(await vbSigner.getAddress());
          const bal_usdt_after = await usdt.balanceOf(await vbSigner.getAddress());
          const bal_eth_after = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

          expect(bal_weth_after).to.be.gt(bal_weth_before);
          expect(bal_usdt_after).to.be.lt(bal_usdt_before);
          expect(bal_eth_after).to.be.lt(bal_eth_before);
      });

      it('should collect a 1 ether fee if swap is forwarded', async () => {
          const { router } = await createRouter();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);

          const bal_eth_before = await hre.ethers.provider.getBalance(await router.getAddress());
          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, { value: parseEther("1.0")});

          const bal_eth_after = await hre.ethers.provider.getBalance(await router.getAddress());

          expect(bal_eth_before).to.be.equal(0);
          expect(bal_eth_after).to.be.equal(ethers.parseEther("1.0"));
      });

      it('should not forward a swap through uniswap v2 if user doesn\' t have enough USDT', async () => {
          const { router } = await createRouter();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
          await expect(router.connect(vbSigner).swap(bal_usdt_before + 100n, USDT_ADDRESS, WETH_ADDRESS, { value: parseEther("1.0")})).to.be.revertedWithoutReason();
      });

  });

});
import hre, {ethers} from "hardhat";
import {parseEther, ZeroAddress} from "ethers";
import {expect} from "chai";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {createPool, createManager, createTokens, depositLiquidity, getSigners, simulateQuote} from "./Helper";

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("DexterManager contract", function () {

  it("should deploy DexterManager Contract", async () => {
    await createManager();
  })

    describe("Pool", function () {
        it("should create a pool", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createManager();

            const { pair } = await createPool(router, tokenA, tokenB);

            expect(await pair.tokenA() == await tokenA.getAddress() || await tokenB.getAddress());
            expect(await pair.tokenB() == await tokenA.getAddress() || await tokenB.getAddress());

            expect(await pair.reserveB()).to.be.equal(0);
            expect(await pair.reserveA()).to.be.equal(0);
            expect(await pair.totalShares()).to.be.equal(0);
        });

        it("should revert custom error if token address is zero", async () => {
            const { tokenA } = await createTokens([], []);
            const { router } = await createManager();

            await expect(router.createPair(tokenA.getAddress(), ZeroAddress)).to.be.revertedWithCustomError(router, "ZeroAddress")
        });

        it("should revert custom error if token address are identical", async () => {
            const { tokenA } = await createTokens([], []);
            const { router } = await createManager();

            await expect(router.createPair(tokenA.getAddress(), tokenA.getAddress())).to.be.revertedWithCustomError(router, "IdenticalAddress");
        });

        it("should revert custom error if pair already exist", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createManager();

            await router.createPair(tokenA.getAddress(), tokenB.getAddress());
            await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.be.revertedWithCustomError(router, "PairAlreadyExist");
        });

        it("should return pair address by using getPair() function", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createManager();
            const { pair } = await createPool(router, tokenA, tokenB);

            const pairAddress = await router.getPair(tokenA.getAddress(), tokenB.getAddress());
            const pairAddressReverse = await router.getPair(tokenB.getAddress(), tokenA.getAddress());

            expect(pairAddress).to.be.equal(await pair.getAddress());
            expect(pairAddressReverse).to.be.equal(await pair.getAddress());
        });

        it("should emit event when new pair is created", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createManager();

            await expect(router.createPair(tokenA.getAddress(), tokenB.getAddress())).to.emit(router, "NewPair").withArgs(tokenA.getAddress(), tokenB.getAddress(), anyValue);
        });

        it("should return zero address if pair isn't exist", async () => {
            const { tokenA, tokenB } = await createTokens([], []);
            const { router } = await createManager();

            expect(await router.getPair(tokenA.getAddress(), tokenB.getAddress())).to.be.equal(ZeroAddress);
        });

    });

  describe("Withdraw fees", function () {
      it('should not be possible to withdraw fees if you are not the owner', async () => {
          const { router } = await createManager();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          await usdt.connect(vbSigner).approve(await router.getAddress(), 1000);

          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, 100000000, { value: parseEther("1.0")});

          await expect(router.connect(vbSigner).withdrawFees()).to.be.revertedWithCustomError(router, "Unauthorized");
      });

      it('should be possible to withdraw fees if you are the owner', async () => {
          const { router } = await createManager();
          const [ toto ] = await getSigners();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          await usdt.connect(vbSigner).approve(await router.getAddress(), 1000);

          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, 100000000, { value: parseEther("1.0")});

          const bal_eth_owner_before_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());

          await router.withdrawFees();

          const bal_eth_after_withdraw = await hre.ethers.provider.getBalance(await router.getAddress());

          const bal_eth_owner_after_withdraw = await hre.ethers.provider.getBalance(await toto.getAddress());

          expect(bal_eth_after_withdraw).to.be.equal(0);
          expect(bal_eth_owner_after_withdraw).to.be.greaterThan(bal_eth_owner_before_withdraw);
      });


  });


    describe("Swap", function () {

        describe("minAmountOut", function () {
            const { amountOut: simulateAmountOut } = simulateQuote(100n, 500n, 500n);

            it ("should revert custom error if amountOut is lower than minAmountOut", async () => {
                const [ toto ] = await getSigners();

                const { tokenA, tokenB } = await createTokens([toto], [1000]);
                const { router } = await createManager();
                const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

                await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

                await pairTokenA.approve(await router.getAddress(), 100);
                expect(router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress(), simulateAmountOut + 10n)).to.be.revertedWithCustomError(pair, "InsufficientOutputAmount");
            });

            it ("should not revert custom error if amountOut is greater or equals than minAmountOut", async () => {
                const [ toto ] = await getSigners();

                const { tokenA, tokenB } = await createTokens([toto], [1000]);
                const { router } = await createManager();
                const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

                await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

                await pairTokenA.approve(await router.getAddress(), 100);
                await router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress(), simulateAmountOut - 10n);
            });


            it ("should not revert custom error if minAmountOut is 0", async () => {
                const [ toto ] = await getSigners();

                const { tokenA, tokenB } = await createTokens([toto], [1000]);
                const { router } = await createManager();
                const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

                await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

                await pairTokenA.approve(await router.getAddress(), 100);
                await router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress(), 0);
            });
        });

        it("should revert custom error when input token is not a pair token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [10000, 10000]);
            const { tokenA: tokenC } = await createTokens([toto], [10000]);

            const { router } = await createManager();

            const { pair } = await createPool(router, tokenA, tokenB);

            await expect(pair.swap(await tokenC.getAddress(), 100, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidInputToken");
        });

        it("should swap token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [1000]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await pairTokenA.approve(await router.getAddress(), 100);
            await router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress(), 0);

            const { amountOut: simulateAmountOut } = simulateQuote(100n, 500n, 500n);

            expect(await pair.reserveA()).to.be.equal(600n);
            expect(await pair.reserveB()).to.be.equal(500n - simulateAmountOut);

            expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(500n - 100n);
            expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(500n + simulateAmountOut);
        });


        it("should revert with a custom error if user don't pre-deposit token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [1000]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await expect(pair.swap(await pairTokenA.getAddress(), 0, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidOutputAmount");

            expect(await pair.reserveA()).to.be.equal(500n);
            expect(await pair.reserveB()).to.be.equal(500n);

            expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(500n);
            expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(500n);
        });

        it("should swap token and emit event", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [10000]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await pairTokenA.approve(await router.getAddress(), 100);
            await router.swap(100, await pairTokenA.getAddress(), pairTokenB.getAddress(), 0);

            const { amountOut: simulateAmountOut } = simulateQuote(100n, 500n, 500n);

            const lastEvent = await pair.queryFilter(pair.filters.Swap());
            expect(lastEvent.length).to.be.equal(1);
            expect(lastEvent[0].args.amountIn).to.be.equal(100n);
            expect(lastEvent[0].args.amountOut).to.be.equal(simulateAmountOut);
            expect(lastEvent[0].args.to).to.be.equal(await toto.getAddress());
            expect(lastEvent[0].args.tokenIn).to.be.equal(await pairTokenA.getAddress());
            expect(lastEvent[0].args.tokenOut).to.be.equal(await pairTokenB.getAddress());
        });


        it("should revert with custom error when user don't have enough token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [600]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await pairTokenA.approve(await router.getAddress(), 5000);

            await expect(router.swap(5000, await pairTokenA.getAddress(), pairTokenB.getAddress(), 0)).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientBalance");
        });

        it("should revert with custom error when user don't have enough allowed token", async () => {
            const [ toto, tata ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto, tata], [600, 1000]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await expect(router.connect(tata).swap(150, await pairTokenA.getAddress(), pairTokenB.getAddress(), 0)).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientAllowance");
        });


        it("should revert with custom error if calculated amount out is zero", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [10000]);
            const { router } = await createManager();
            const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await expect(pair.swap(await pairTokenA.getAddress(), 1, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidOutputAmount");
        });

      it("should swap tokens through the router if the pair exist", async () => {
          const [ toto ] = await ethers.getSigners();

          const { tokenA, tokenB } = await createTokens([toto], [1000, 1000]);

          const { router } = await createManager();

          const { pair, pairTokenA, pairTokenB } = await createPool(router, tokenA, tokenB);

          await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

          await pairTokenA.approve(await router.getAddress(), 100);
          await router.swap(100, await pairTokenA.getAddress(), await pairTokenB.getAddress(), 0);

          const { amountOut: simulateAmountOut } = simulateQuote(100n, 500n, 500n);
          expect(await pair.reserveB()).to.be.equal(500n - simulateAmountOut);
          expect(await pair.reserveA()).to.be.equal(500n + 100n);

          expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(1000n - 500n - 100n);
          expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(1000n - 500n + simulateAmountOut);
      })

      it('should forward a swap through uniswap v2 if the pair doesn\' t exist', async () => {
          const { router } = await createManager();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_weth_before = await weth.balanceOf(await vbSigner.getAddress());
          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());
          const bal_eth_before = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, 1000000000, { value: parseEther("1.0")});

          const bal_weth_after = await weth.balanceOf(await vbSigner.getAddress());
          const bal_usdt_after = await usdt.balanceOf(await vbSigner.getAddress());
          const bal_eth_after = await hre.ethers.provider.getBalance(await vbSigner.getAddress());

          expect(bal_weth_after).to.be.gt(bal_weth_before);
          expect(bal_usdt_after).to.be.lt(bal_usdt_before);
          expect(bal_eth_after).to.be.lt(bal_eth_before);
      });

      it('should collect a 1 ether fee if swap is forwarded', async () => {
          const { router } = await createManager();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);

          const bal_eth_before = await hre.ethers.provider.getBalance(await router.getAddress());
          await router.connect(vbSigner).swap(1000, USDT_ADDRESS, WETH_ADDRESS, 10000000000, { value: parseEther("1.0")});

          const bal_eth_after = await hre.ethers.provider.getBalance(await router.getAddress());

          expect(bal_eth_before).to.be.equal(0);
          expect(bal_eth_after).to.be.equal(ethers.parseEther("1.0"));
      });

      it('should not forward a swap through uniswap v2 if user doesn\' t have enough USDT', async () => {
          const { router } = await createManager();

          const vbSigner = await ethers.getImpersonatedSigner(VITALIK_ADDRESS);

          const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

          const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

          await usdt.connect(vbSigner).approve(await router.getAddress(), bal_usdt_before);
          await expect(router.connect(vbSigner).swap(bal_usdt_before + 100n, USDT_ADDRESS, WETH_ADDRESS, 100000000, { value: parseEther("1.0")})).to.be.revertedWithoutReason();
      });

  });

});
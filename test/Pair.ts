import {expect} from "chai";
import {createPair, createRouter, createTokens, depositLiquidity, getSigners, simulateQuote} from "./Helper";

describe("Pair", function () {

    describe("Get Quote", function () {
        it("should return a quote equals to the simulate quote", async () => {
            const [ toto, tata ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 10000, 10000);

            const { amountOut } = simulateQuote(200n, await pair.reserveA(), await pair.reserveB());

            expect(await pair.getQuote(pairTokenA.getAddress(), 200)).to.be.equal(amountOut);
        });

        it("should return a quote equals to the simulate quote if the pool is non equitable", async () => {
            const [ toto, tata ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 10000, 4000);

            const { amountOut } = simulateQuote(555n, await pair.reserveB(), await pair.reserveA());

            expect(await pair.getQuote(pairTokenB.getAddress(), 555)).to.be.equal(amountOut);
        });

        it("should revert custom error when reserves are empty", async () => {
            const [ toto, tata ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
            const { router } = await createRouter();
            const { pair, pairTokenA } = await createPair(router, tokenA, tokenB);

            await expect(pair.getQuote(pairTokenA.getAddress(), 200)).to.be.revertedWithCustomError(pair, "NotEnoughReserve");
        });

        it("should revert custom error when input token is not a pair token", async () => {
            const [ toto, tata ] = await getSigners();

            const { tokenA, tokenB} = await createTokens([toto, tata], [10000, 10000]);
            const { tokenA: tokenC } = await createTokens([], []);
            const { router } = await createRouter();
            const { pair } = await createPair(router, tokenA, tokenB);

            await expect(pair.getQuote(tokenC.getAddress(), 10)).to.be.revertedWithCustomError(pair, "InvalidInputToken");
        });
    });

    describe("Swap", function () {
        it("should revert custom error when input token is not a pair token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [10000, 10000]);
            const { tokenA: tokenC } = await createTokens([toto], [10000]);

            const { router } = await createRouter();

            const { pair } = await createPair(router, tokenA, tokenB);

            await expect(pair.swap(await tokenC.getAddress(), 100, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidInputToken");
        });


        it("should revert with a custom error if user don't pre-deposit token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [1000]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await expect(pair.swap(await pairTokenA.getAddress(), 0, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidOutputAmount");

            expect(await pair.reserveA()).to.be.equal(500n);
            expect(await pair.reserveB()).to.be.equal(500n);

            expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(500n);
            expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(500n);
        });

        it("should revert with custom error if calculated amount out is zero", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [10000]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

            await expect(pair.swap(await pairTokenA.getAddress(), 1, await toto.getAddress())).to.be.revertedWithCustomError(pair, "InvalidOutputAmount");
        });
    });

    describe("Deposit Liquidity", function () {

        it("should revert with custom error if user don't have enough token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [100]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 100, 200)).to.be.revertedWithCustomError(pairTokenA, "ERC20InsufficientBalance");
            await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 200, 100)).to.be.revertedWithCustomError(pairTokenA, "ERC20InsufficientBalance");
        });

        it("should revert with custom error if user try to deposit 0 token", async () => {
            const [ toto ] = await getSigners();

            const { tokenA, tokenB } = await createTokens([toto], [100]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 0, 0)).to.be.revertedWithCustomError(pair, "NotEnoughLiquidityProvided");
        });

        it("should emit event when user deposit liquidity", async () => {
                const [ toto ] = await getSigners();
                const balance = 100_000_000;

                const { tokenA, tokenB } = await createTokens([toto], [balance]);
                const { router } = await createRouter();
                const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

                await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100);

                const lastEvent = await pair.queryFilter(pair.filters.AddLiquidity());

                expect(lastEvent.length).to.be.equal(1);
                expect(lastEvent[0].args.adder).to.be.equal(await toto.getAddress());
                expect(lastEvent[0].args.amountA).to.be.equal(100);
                expect(lastEvent[0].args.amountB).to.be.equal(100);
        });


        [[100, 100, 300, 300, 100, 400], [150, 100, 124, 300, 122, 222], [5, 59, 12, 14, 17, 21]].forEach(([amountA, amountB, amountA2, amountB2, firstTimeShares, secondTimeShares]) => { // a refaire
            it("should update reserves and shares for the first and second time if user deposit liquidity", async () => {
                const [ toto ] = await getSigners();
                const balance = 100_000_000;

                const { tokenA, tokenB } = await createTokens([toto], [balance]);
                const { router } = await createRouter();
                const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

                // First time deposit
                await depositLiquidity(pair, pairTokenA, pairTokenB, amountA, amountB);

                expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - amountA);
                expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - amountB);

                expect(await pair.reserveA()).to.be.equal(amountA);
                expect(await pair.reserveB()).to.be.equal(amountB);

                expect(await pair.shares(await toto.getAddress())).to.be.equal(firstTimeShares);

                // Second time deposit
                await depositLiquidity(pair, pairTokenA, pairTokenB, amountA2, amountB2);

                expect(await pairTokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - amountA - amountA2);
                expect(await pairTokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - amountB - amountB2);

                expect(await pair.reserveA()).to.be.equal(amountA + amountA2);
                expect(await pair.reserveB()).to.be.equal(amountB + amountB2);

                expect(await pair.shares(await toto.getAddress())).to.be.equal(secondTimeShares);

            });

        });

    });

    describe("Withdraw Liquidity", function () {
        it("should withdraw liquidity and transfer token to remover", async () => {
            const [toto, tata] = await getSigners();
            const balance = 100_000_000;

            const {tokenA, tokenB} = await createTokens([toto, tata], [balance, balance]);
            const {router} = await createRouter();
            const {pair, pairTokenA, pairTokenB} = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100, toto);
            await depositLiquidity(pair, pairTokenA, pairTokenB, 200, 200, tata);

            const sharesToto = await pair.shares(await toto.getAddress());
            const sharesTata = await pair.shares(await tata.getAddress());

            await pair.connect(tata).removeLiquidity(sharesTata);

            expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto);

            expect(await tokenA.balanceOf(await tata.getAddress())).to.be.equal(balance);
            expect(await tokenB.balanceOf(await tata.getAddress())).to.be.equal(balance);

            expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
            expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        });

        it("should emit event when user remove liquidity", async () => {
            const [toto, tata] = await getSigners();
            const balance = 100_000_000;

            const {tokenA, tokenB} = await createTokens([toto, tata], [balance, balance]);
            const {router} = await createRouter();
            const {pair, pairTokenA, pairTokenB} = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100, toto);
            await depositLiquidity(pair, pairTokenA, pairTokenB, 200, 200, tata);

            const sharesTata = await pair.shares(await tata.getAddress());

            await pair.connect(tata).removeLiquidity(sharesTata);

            const lastEvent = await pair.queryFilter(pair.filters.RemoveLiquidity());
            expect(lastEvent.length).to.be.equal(1);
            expect(lastEvent[0].args.remover).to.be.equal(await tata.getAddress());
            expect(lastEvent[0].args.shares).to.be.equal(sharesTata);
            expect(lastEvent[0].args.amountA).to.be.equal(200);
            expect(lastEvent[0].args.amountB).to.be.equal(200);
        });

        it("should not be possible to more shares than you have", async () => {
            const [toto] = await getSigners();
            const balance = 100_000_000;

            const {tokenA, tokenB} = await createTokens([toto], [balance]);
            const {router} = await createRouter();
            const {pair, pairTokenA, pairTokenB} = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100);

            const sharesToto = await pair.shares(await toto.getAddress());

            await expect(pair.removeLiquidity(sharesToto + 100n)).to.be.revertedWithCustomError(pair, "NotEnoughShares");

            expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto);

            expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
            expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        });

        it("should be possible to withdraw partially your shares", async () => {
            const [toto] = await getSigners();
            const balance = 100_000_000;

            const {tokenA, tokenB} = await createTokens([toto], [balance]);
            const {router} = await createRouter();
            const {pair, pairTokenA, pairTokenB} = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100);

            const sharesToto = await pair.shares(await toto.getAddress());

            await pair.removeLiquidity(sharesToto / 2n);

            expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto / 2n);

            expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 50);
            expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 50);
        });

    });
});
import hre, {ethers} from "hardhat";
import {DumbERC20, Pair, Router} from "../typechain-types";
import {Addressable} from "ethers";
import {expect} from "chai";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {UNISWAP_V2_ROUTER_ADDRESS} from "./Constants";

describe("Pair", function () {

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

    it("Get quote", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 10000, 10000);

        const { amountOut } = await simulateQuote(200n, await pair.reserveA(), await pair.reserveB());

        expect(await pair.getQuote(pairTokenA.getAddress(), 200)).to.be.equal(amountOut);
    });

    it("Get quote for non equitable pools", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 10000, 4000);

        const { amountOut } = await simulateQuote(555n, await pair.reserveB(), await pair.reserveA());

        expect(await pair.getQuote(pairTokenB.getAddress(), 555)).to.be.equal(amountOut);
    });

    it("Get quote with empty reserves", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await expect(pair.getQuote(pairTokenA.getAddress(), 200)).to.be.revertedWith("Reserves must be greater than zero");
    });


    it("Get quote for a 0", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto, tata], [10000, 10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA } = await createPair(router, tokenA, tokenB);

        await expect(pair.getQuote(pairTokenA.getAddress(), 0)).to.be.revertedWith("Amount in must be greater than zero");
    });

    it("Get quote without the good token", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB} = await createTokens([toto, tata], [10000, 10000]);
        const { tokenA: tokenC } = await createTokens([], []);
        const { router } = await createRouter();
        const { pair } = await createPair(router, tokenA, tokenB);

        await expect(pair.getQuote(tokenC.getAddress(), 10)).to.be.revertedWith("INVALID_TOKEN_IN");
    });

    it("Swap a non existing pool", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [10000, 10000]);
        const { tokenA: tokenC } = await createTokens([toto], [10000]);

        const { router } = await createRouter();

        const { pair } = await createPair(router, tokenA, tokenB);

        await expect(pair.swap(await tokenC.getAddress(), 100)).to.be.revertedWith("Invalid input token");
    });

    it("Can swap", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await pair.swap(await pairTokenA.getAddress(), 100);

        const { amountOut: simulateAmountOut } = await simulateQuote(100n, 500n, 500n);
        expect(await pair.reserveB()).to.be.equal(500n - simulateAmountOut);
        expect(await pair.reserveA()).to.be.equal(600n);


        const lastEvent = await pair.queryFilter(pair.filters.Swap());
        expect(lastEvent.length).to.be.equal(1);
        expect(lastEvent[0].args.amountIn).to.be.equal(100n);
        expect(lastEvent[0].args.amountOut).to.be.equal(simulateAmountOut);
        expect(lastEvent[0].args.sender).to.be.equal(await toto.getAddress());
        expect(lastEvent[0].args.tokenIn).to.be.equal(await pairTokenA.getAddress());
        expect(lastEvent[0].args.tokenOut).to.be.equal(await pairTokenB.getAddress());
    });

    it("Cannot swap with amountIn = zero", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await expect(pair.swap(await pairTokenA.getAddress(), 0)).to.be.revertedWith("Invalid input amount");
    });

    it("Cannot swap with bad token address", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [10000]);
        const { tokenA: tokenC } = await createTokens([], []);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await expect(pair.swap(await tokenC.getAddress(), 100)).to.be.revertedWith("Invalid input token");
    });

    it("Cannot swap because not user don't have enought token", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [600]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await expect(pair.swap(await tokenA.getAddress(), 150)).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientBalance");
    });

    it("Cannot swap because user hadn't accept allowance", async () => {
        const [ toto, tata ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto, tata], [600, 1000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await expect(pair.connect(tata).swap(await tokenA.getAddress(), 150)).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientAllowance");
    });


    it("Cannot swap because amountOut is zero", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [10000]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 500, 500);

        await expect(pair.swap(await pairTokenA.getAddress(), 1)).to.be.revertedWith("Insufficient output amount");
    });

    it("Cannot deposit liquidity because user don't have enought token", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [100]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 100, 200)).to.be.revertedWithCustomError(pairTokenA, "ERC20InsufficientBalance");
        await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 200, 100)).to.be.revertedWithCustomError(pairTokenA, "ERC20InsufficientBalance");
    });

    it("Cannot deposit 0 token", async () => {
        const [ toto ] = await getSigners();

        const { tokenA, tokenB } = await createTokens([toto], [100]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await expect(depositLiquidity(pair, pairTokenA, pairTokenB, 0, 0)).to.be.revertedWith("Insufficient liquidity provided");
    });

    [[100, 100, 300, 300]].forEach(([amountA, amountB, amountA2, amountB2]) => {
        it("Can deposit token", async () => {
            const [ toto ] = await getSigners();
            const balance = 100_000_000;

            const { tokenA, tokenB } = await createTokens([toto], [balance]);
            const { router } = await createRouter();
            const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

            await depositLiquidity(pair, pairTokenA, pairTokenB, amountA, amountB);

            expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - amountA);
            expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - amountB);

            expect(await pair.reserveA()).to.be.equal(amountA);
            expect(await pair.reserveB()).to.be.equal(amountB);

            const firstTimeShares = Math.sqrt(amountA * amountB);

            expect(await pair.totalShares()).to.be.equal(firstTimeShares);
            expect(await pair.shares(await toto.getAddress())).to.be.equal(firstTimeShares);

            await depositLiquidity(pair, pairTokenA, pairTokenB, amountA2, amountB2);

            const secondTimeShares =  Math.min(
                (amountA2 * Number(await pair.totalShares())) / Number(await pair.reserveA()),
                (amountB2 * Number(await pair.totalShares())) / Number(await pair.reserveB())
            ) + firstTimeShares;

            expect(await pair.totalShares()).to.be.equal(secondTimeShares);
            expect(await pair.reserveA()).to.be.equal(amountA + amountA2);
            expect(await pair.reserveB()).to.be.equal(amountB + amountB2);
            expect(await pair.shares(await toto.getAddress())).to.be.equal(secondTimeShares);
            expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - (amountA + amountA2));
            expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - (amountB + amountB2));

            const lastEvent = await pair.queryFilter(pair.filters.AddLiquidity());

            expect(lastEvent.length).to.be.equal(2);
            expect(lastEvent[0].args.sender).to.be.equal(await toto.getAddress());
            expect(lastEvent[0].args.amountA).to.be.equal(amountA);
            expect(lastEvent[0].args.amountB).to.be.equal(amountB);

            expect(lastEvent[1].args.sender).to.be.equal(await toto.getAddress());
            expect(lastEvent[1].args.amountA).to.be.equal(amountA2);
            expect(lastEvent[1].args.amountB).to.be.equal(amountB2);

        });

    });

    it("Can withdraw liquidity", async () => {
        const [ toto, tata ] = await getSigners();
        const balance = 100_000_000;

        const { tokenA, tokenB } = await createTokens([toto, tata], [balance, balance]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100, toto);
        await depositLiquidity(pair, pairTokenA, pairTokenB, 200, 200, tata);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);

        expect(await tokenA.balanceOf(await tata.getAddress())).to.be.equal(balance - 200);
        expect(await tokenB.balanceOf(await tata.getAddress())).to.be.equal(balance - 200);

        expect(await pair.reserveA()).to.be.equal(300);
        expect(await pair.reserveB()).to.be.equal(300);

        const sharesToto = await pair.shares(await toto.getAddress());
        const sharesTata = await pair.shares(await tata.getAddress());

        await pair.connect(tata).removeLiquidity(sharesTata);

        expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto);

        expect(await tokenA.balanceOf(await tata.getAddress())).to.be.equal(balance);
        expect(await tokenB.balanceOf(await tata.getAddress())).to.be.equal(balance);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);

        const lastEvent = await pair.queryFilter(pair.filters.RemoveLiquidity());
        expect(lastEvent.length).to.be.equal(1);
        expect(lastEvent[0].args.sender).to.be.equal(await tata.getAddress());
        expect(lastEvent[0].args.shares).to.be.equal(sharesTata);
    });

    it("Cannot withdraw more token than you have", async () => {
        const [ toto ] = await getSigners();
        const balance = 100_000_000;

        const { tokenA, tokenB } = await createTokens([toto], [balance]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);

        expect(await pair.reserveA()).to.be.equal(100);
        expect(await pair.reserveB()).to.be.equal(100);

        const sharesToto = await pair.shares(await toto.getAddress());

        await expect(pair.removeLiquidity(sharesToto + 100n)).to.be.revertedWith("Insufficient shares");

        expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
    });

    it("Can withdraw partial shares", async () => {
        const [ toto ] = await getSigners();
        const balance = 100_000_000;

        const { tokenA, tokenB } = await createTokens([toto], [balance]);
        const { router } = await createRouter();
        const { pair, pairTokenA, pairTokenB } = await createPair(router, tokenA, tokenB);

        await depositLiquidity(pair, pairTokenA, pairTokenB, 100, 100);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 100);

        expect(await pair.reserveA()).to.be.equal(100);
        expect(await pair.reserveB()).to.be.equal(100);

        const sharesToto = await pair.shares(await toto.getAddress());

        await pair.removeLiquidity(sharesToto / 2n);

        expect(await pair.shares(await toto.getAddress())).to.be.equal(sharesToto / 2n);

        expect(await tokenA.balanceOf(await toto.getAddress())).to.be.equal(balance - 50);
        expect(await tokenB.balanceOf(await toto.getAddress())).to.be.equal(balance - 50);
    });


});
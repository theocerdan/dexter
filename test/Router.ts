import {ethers} from "hardhat";
import {expect} from "chai";
import {Contract, Signer} from "ethers";
import {DumbERC20, Router, Pair} from "../typechain-types";

describe("Router contract", function () {

  let router: Router;
  let tokenA: DumbERC20;
  let tokenB: DumbERC20;
  let tokenAAddress: string;
  let tokenBAddress: string;
  let owner: Signer, toto: Signer;

  before(async () => {
    [owner, toto] = await ethers.getSigners();
  })

  beforeEach(async() => {
    router = await ethers.deployContract("Router");
    tokenA = await ethers.deployContract("DumbERC20", ["TokenA", "A"]);
    tokenB = await ethers.deployContract("DumbERC20", ["TokenB", "B"]);

    await tokenA.mint(owner.getAddress(), 1000);
    await tokenB.mint(owner.getAddress(), 1000);

    await tokenA.mint(toto.getAddress(), 1000);
    await tokenB.mint(toto.getAddress(), 1000);

    tokenAAddress = await tokenA.getAddress();
    tokenBAddress = await tokenB.getAddress();
  })

  describe("initialize router", async () => {
    it("owner is sender", async () => {
      expect(await router.owner()).to.be.equal(await owner.getAddress());
    })
  });


  describe("create new pair", async () => {
    it("create create new pair", async () => {
      await router.createPair(tokenAAddress, tokenBAddress);
    });
  })

  describe("liquidity deposit", async () => {
    beforeEach(async () => {

    });

    it("two user add equivalent liquidity", async () => {
      await router.createPair(tokenAAddress, tokenBAddress);

      const events = await router.queryFilter(router.filters.NewPair());

      const pairAddress = events[0].args.pair;
      const pairContract = await ethers.getContractAt("Pair", pairAddress) as Pair;

      await tokenA.connect(owner).approve(pairAddress, 1000);
      await tokenB.connect(owner).approve(pairAddress, 1000);

      await tokenA.connect(toto).approve(pairAddress, 1000);
      await tokenB.connect(toto).approve(pairAddress, 1000);

      await pairContract.connect(owner).addLiquidity(100, 100);
      await pairContract.connect(toto).addLiquidity(100, 100);

      expect(await pairContract.shares(owner.getAddress())).to.be.equal(100);
      expect(await pairContract.shares(toto.getAddress())).to.be.equal(100);

      expect(await tokenA.balanceOf(pairAddress)).to.be.equal(200);
      expect(await tokenB.balanceOf(pairAddress)).to.be.equal(200);

      expect(await tokenA.balanceOf(owner.getAddress())).to.be.equal(900);
      expect(await tokenB.balanceOf(owner.getAddress())).to.be.equal(900);

      expect(await tokenA.balanceOf(toto.getAddress())).to.be.equal(900);
      expect(await tokenB.balanceOf(toto.getAddress())).to.be.equal(900);

      expect(await pairContract.totalShares()).to.be.equal(200);
    });

    it("two user add non-equivalent liquidity", async () => {
      await router.createPair(tokenAAddress, tokenBAddress);

      const events = await router.queryFilter(router.filters.NewPair());

      const pairAddress = events[0].args.pair;
      const pairContract = await ethers.getContractAt("Pair", pairAddress) as Pair;

      await tokenA.connect(owner).approve(pairAddress, 1000);
      await tokenB.connect(owner).approve(pairAddress, 1000);

      await tokenA.connect(toto).approve(pairAddress, 1000);
      await tokenB.connect(toto).approve(pairAddress, 1000);

      await pairContract.connect(owner).addLiquidity(450, 40);
      await pairContract.connect(toto).addLiquidity(10, 700);

      expect(await pairContract.shares(owner.getAddress())).to.be.equal(134);
      expect(await pairContract.shares(toto.getAddress())).to.be.equal(2);

      expect(await tokenA.balanceOf(pairAddress)).to.be.equal(460);
      expect(await tokenB.balanceOf(pairAddress)).to.be.equal(740);

      expect(await tokenA.balanceOf(owner.getAddress())).to.be.equal(550);
      expect(await tokenB.balanceOf(owner.getAddress())).to.be.equal(960);

      expect(await tokenA.balanceOf(toto.getAddress())).to.be.equal(990);
      expect(await tokenB.balanceOf(toto.getAddress())).to.be.equal(300);

      expect(await pairContract.totalShares()).to.be.equal(136);
    });

    it("two user remove liquidity", async () => {
      await router.createPair(tokenAAddress, tokenBAddress);

      const events = await router.queryFilter(router.filters.NewPair());

      const pairAddress = events[0].args.pair;
      const pairContract = await ethers.getContractAt("Pair", pairAddress) as Pair;

      await tokenA.connect(owner).approve(pairAddress, 1000);
      await tokenB.connect(owner).approve(pairAddress, 1000);

      await tokenA.connect(toto).approve(pairAddress, 1000);
      await tokenB.connect(toto).approve(pairAddress, 1000);

      await pairContract.connect(owner).addLiquidity(450, 40);
      await pairContract.connect(toto).addLiquidity(10, 700);

      expect(await pairContract.shares(owner.getAddress())).to.be.equal(134);
      expect(await pairContract.shares(toto.getAddress())).to.be.equal(2);

      expect(await tokenA.balanceOf(pairAddress)).to.be.equal(460);
      expect(await tokenB.balanceOf(pairAddress)).to.be.equal(740);

      expect(await tokenA.balanceOf(owner.getAddress())).to.be.equal(550);
      expect(await tokenB.balanceOf(owner.getAddress())).to.be.equal(960);

      expect(await tokenA.balanceOf(toto.getAddress())).to.be.equal(990);
      expect(await tokenB.balanceOf(toto.getAddress())).to.be.equal(300);

      expect(await pairContract.totalShares()).to.be.equal(136);

      await pairContract.connect(owner).removeLiquidity(100);

      expect(await pairContract.shares(owner.getAddress())).to.be.equal(34);
      expect(await pairContract.shares(toto.getAddress())).to.be.equal(2);

      expect(await tokenA.balanceOf(pairAddress)).to.be.equal(122);
      expect(await tokenB.balanceOf(pairAddress)).to.be.equal(196);

      expect(await tokenA.balanceOf(owner.getAddress())).to.be.equal(888);
      expect(await tokenB.balanceOf(owner.getAddress())).to.be.equal(1504);

      expect(await tokenA.balanceOf(toto.getAddress())).to.be.equal(990);
      expect(await tokenB.balanceOf(toto.getAddress())).to.be.equal(300);

      expect(await pairContract.totalShares()).to.be.equal(36);
    });

    it("two user remove liquidity", async () => {
      await router.createPair(tokenAAddress, tokenBAddress);

      const events = await router.queryFilter(router.filters.NewPair());

      const pairAddress = events[0].args.pair;
      const pairContract = await ethers.getContractAt("Pair", pairAddress) as Pair;

      await tokenA.connect(owner).approve(pairAddress, 1000);
      await tokenB.connect(owner).approve(pairAddress, 1000);

      await pairContract.connect(owner).addLiquidity(100, 100);

      expect(await pairContract.totalShares()).to.be.equal(100);

      await expect(pairContract.connect(owner).removeLiquidity(101)).to.be.revertedWith("Insufficient liquidity");

      expect(await pairContract.totalShares()).to.be.equal(100);
      expect(await pairContract.shares(owner.getAddress())).to.be.equal(100);
    });

  })

    describe("swap", async () => {
      let pairContract: Pair;
      let pairAddress: string;

      beforeEach(async () => {
          await router.createPair(tokenAAddress, tokenBAddress);

          const events = await router.queryFilter(router.filters.NewPair());
          pairAddress = events[0].args.pair;
          pairContract = await ethers.getContractAt("Pair", pairAddress) as Pair;

          await tokenA.mint(owner.getAddress(), 100000);
          await tokenB.mint(owner.getAddress(), 100000);

          await tokenA.mint(toto.getAddress(), 100000);
          await tokenB.mint(toto.getAddress(), 100000);

          await tokenA.connect(owner).approve(pairAddress, 100000);
          await tokenB.connect(owner).approve(pairAddress, 100000);

          await tokenA.connect(toto).approve(pairAddress, 100000);
          await tokenB.connect(toto).approve(pairAddress, 100000);

          await pairContract.connect(owner).addLiquidity(100, 80);
          await pairContract.connect(toto).addLiquidity(100, 80);
      });

      it("swap tokenA to tokenB", async () => {
        await printPool(pairContract, pairAddress, tokenA, tokenB);
        await console.log("Owner tokenA balance: ", await tokenA.balanceOf(owner.getAddress()));
        await console.log("Owner tokenB balance: ", await tokenB.balanceOf(owner.getAddress()));


        await pairContract.connect(owner).swapTokenAToTokenB(99900);

        await printPool(pairContract, pairAddress, tokenA, tokenB);
        await console.log("Owner tokenA balance: ", await tokenA.balanceOf(owner.getAddress()));
        await console.log("Owner tokenB balance: ", await tokenB.balanceOf(owner.getAddress()));
      });

      it("swap tokenA to tokenB negative", async () => {
        await printPool(pairContract, pairAddress, tokenA, tokenB);
        await console.log("Owner tokenA balance: ", await tokenA.balanceOf(owner.getAddress()));
        await console.log("Owner tokenB balance: ", await tokenB.balanceOf(owner.getAddress()));


        await pairContract.connect(owner).swapTokenAToTokenB(-1);

        await printPool(pairContract, pairAddress, tokenA, tokenB);
        await console.log("Owner tokenA balance: ", await tokenA.balanceOf(owner.getAddress()));
        await console.log("Owner tokenB balance: ", await tokenB.balanceOf(owner.getAddress()));
      });
    });
});

const printPool = async (pair: Pair, pairAddress: string, tokenA: DumbERC20, tokenB: DumbERC20) => {
  console.log("======= Pool ========");
  console.log("Total shares: ", await pair.totalShares());
  console.log("Token A reserve: ", await pair.reserveA());
  console.log("Token B reserve: ", await pair.reserveB());
  console.log("Token A balanceof(pool): ", await tokenA.balanceOf(pairAddress));
  console.log("Token B balanceof(pool): ", await tokenB.balanceOf(pairAddress));
  console.log("Token A fees: ", await pair.totalFeesA());
  console.log("Token B fees: ", await pair.totalFeesB());
}


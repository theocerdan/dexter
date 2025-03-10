import {HardhatUserConfig, task} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import '@typechain/hardhat'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import 'hardhat-abi-exporter'
import router from "./ignition/modules/Router";
import {Router} from "./typechain-types";

task(
    'block-number',
    'Prints the current block number',
    async (taskArgs, hre) => {
      await hre.ethers.provider.getBlockNumber().then((blockNumber: number) => {
        console.log(`Block number : ${blockNumber}`);
      });
    }
);

task("balance", "Prints an account's balance")
    .addParam("account", "The account's address")
    .setAction(async (taskArgs, hre) => {
      const balance = await hre.ethers.provider.getBalance(taskArgs.account);
      console.log(hre.ethers.formatEther(balance), "ETH");
    }
);


task("router")
    .setAction(async (taskArgs, hre) => {
            const signer = await hre.ethers.getSigners();
            const address = await signer[0].getAddress();
            const routerContract = await hre.ethers.getContractFactory("Router");
            const tokenContract = await hre.ethers.getContractFactory("DumbERC20");

            const tokenA = await tokenContract.deploy("TokenA", "TKA");
            const tokenB = await tokenContract.deploy("TokenB", "TKB");
            const tokenC = await tokenContract.deploy("TokenC", "TKC");
            const router = await routerContract.deploy();

            await tokenA.mint(address, 1000);
            await tokenB.mint(address, 1000);

            console.log("Contract TokenA deployed to address:", await tokenA.getAddress());
            console.log("Contract TokenB deployed to address:", await tokenB.getAddress());
            console.log("Contract TokenB deployed to address:", await tokenC.getAddress());
            console.log("Contract Router deployed to address:", await router.getAddress());

            const pair1 = await router.createPair(await tokenA.getAddress(), await tokenB.getAddress());
            const pair2 = await router.createPair(await tokenC.getAddress(), await tokenB.getAddress());

            await pair1.wait();
            await pair2.wait();

            console.log("Pair 1 created at address:", pair1.hash);
            console.log("Pair 2 created at address:", pair2.hash);
        }
    );


task("mint")
    .addParam("target", "The contract's address")
    .setAction(async (taskArgs, hre) => {
            const token = await hre.ethers.getContractAt("DumbERC20", taskArgs.target);
            const signer = await hre.ethers.getSigners();
            const address = await signer[0].getAddress();

            console.log(address)

            await token.mint(address, 1000);
            console.log("Minted 1000 tokens to", address);
        });

task("get-pairs")
    .addParam("target", "The contract's address")
    .setAction(async (taskArgs, hre) => {
            const router = await hre.ethers.getContractAt("Router", taskArgs.target);

            const events = await router.queryFilter(router.filters.NewPair, 0, "latest");

            events.forEach((event) => {
                console.log(event.args.tokenA, event.args.tokenB, event.args.pair);
            })
        }
    );

task("remove-allowance")
    .addParam("target", "The pair's address")
    .setAction(async (taskArgs, hre) => {
            const pair = await hre.ethers.getContractAt("Pair", taskArgs.target);
            const tokenA = await hre.ethers.getContractAt("ERC20", await pair.tokenA());
            const tokenB = await hre.ethers.getContractAt("ERC20", await pair.tokenB());

            await tokenA.approve(await pair.getAddress(), 0);
            await tokenB.approve(await pair.getAddress(), 0);
        }
    );


const config: HardhatUserConfig = {
  solidity: "0.8.28",
};

export default config;

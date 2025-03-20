import {task} from "hardhat/config";

task(
    'block-number',
    'Prints the current block number',
    async (taskArgs, hre) => {
        await hre.ethers.provider.getBlockNumber().then((blockNumber: number) => {
            console.log(`Block number : ${blockNumber}`);
        });
    });

task("balance", "Prints an account's balance")
    .addParam("account", "The account's address")
    .setAction(async (taskArgs, hre) => {
            const balance = await hre.ethers.provider.getBalance(taskArgs.account);
            console.log(hre.ethers.formatEther(balance), "ETH");
        }
    );

task("balanceERC20", "Prints an account's ERC20 balance")
    .addParam("account", "The account's address")
    .addParam("token", "The token's address")
    .setAction(async (taskArgs, hre) => {
            const token = await hre.ethers.getContractAt("ERC20", taskArgs.token);
            const balance = await token.balanceOf(taskArgs.account);
            console.log(balance.toString());
        }
    );

task("router")
    .addParam("uniswap", "The contract's address")
    .setAction(async (taskArgs, hre) => {
            const signer = await hre.ethers.getSigners();
            const address = await signer[0].getAddress();
            const routerContract = await hre.ethers.getContractFactory("Router");
            const tokenContract = await hre.ethers.getContractFactory("DumbERC20");

            const tokenA = await tokenContract.deploy("TokenA", "TKA");
            const tokenB = await tokenContract.deploy("TokenB", "TKB");
            const tokenC = await tokenContract.deploy("TokenC", "TKC");
            const router = await routerContract.deploy(taskArgs.uniswap);

            await tokenA.mint(address, 1000);
            await tokenB.mint(address, 1000);

            console.log("Contract TokenA deployed to address:", await tokenA.getAddress());
            console.log("Contract TokenB deployed to address:", await tokenB.getAddress());
            console.log("Contract TokenC deployed to address:", await tokenC.getAddress());
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

task("move-fund")
    .setAction(async (taskArgs, hre) => {

            const VbAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
            const myAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
            const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
            const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

            const vbSigner = await hre.ethers.getImpersonatedSigner(VbAddress);

            const weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
            const usdt = await hre.ethers.getContractAt("IERC20", USDT_ADDRESS);

            const bal_weth_before = await weth.balanceOf(await vbSigner.getAddress());
            const bal_usdt_before = await usdt.balanceOf(await vbSigner.getAddress());

            console.log("bal_weth_before", bal_weth_before.toString());
            console.log("bal_usdt_before", bal_usdt_before.toString());

            await usdt.connect(vbSigner).transfer(myAddress, bal_usdt_before);
            await weth.connect(vbSigner).transfer(myAddress, bal_weth_before);
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

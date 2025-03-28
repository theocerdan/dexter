import {task} from "hardhat/config";
import {formatUnits, parseUnits} from "ethers";

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

task("manager")
    .addParam("uniswap", "The contract's address")
    .setAction(async (taskArgs, hre) => {
            const feeData = await hre.ethers.provider.getFeeData();

            const signer = await hre.ethers.getSigners();
            const address = await signer[0].getAddress();
            const routerContract = await hre.ethers.getContractFactory("DexterManager");
            const tokenContract = await hre.ethers.getContractFactory("DumbERC20");

            const tokenA = await tokenContract.deploy("TokenA", "TKA", { gasPrice: feeData.gasPrice });
            const tokenB = await tokenContract.deploy("TokenB", "TKB", { gasPrice: feeData.gasPrice });
            const tokenC = await tokenContract.deploy("TokenC", "TKC", { gasPrice: feeData.gasPrice });
            const router = await routerContract.deploy(taskArgs.uniswap, { gasPrice: feeData.gasPrice });

            await tokenA.mint(address, parseUnits("10000", 18));
            await tokenB.mint(address, parseUnits("10000", 18));
            await tokenC.mint(address, parseUnits("10000", 18));

            console.log("Contract TokenA deployed to address:", await tokenA.getAddress());
            console.log("Contract TokenB deployed to address:", await tokenB.getAddress());
            console.log("Contract TokenC deployed to address:", await tokenC.getAddress());
            console.log("Contract DexterManager deployed to address:", await router.getAddress());

            const pair1 = await router.createPair(await tokenA.getAddress(), await tokenB.getAddress());
            const pair2 = await router.createPair(await tokenC.getAddress(), await tokenB.getAddress());

            await pair1.wait();
            await pair2.wait();

            console.log("DexterPool.sol 1 created at address:", pair1.hash);
            console.log("DexterPool.sol 2 created at address:", pair2.hash);
        }
    );


task("steal")
    .addParam("victim", "The contract's address")
    .addParam("erc20", "The token's address")
    .setAction(async (taskArgs, hre) => {
            const signer = await hre.ethers.getSigners();
            const address = await signer[0].getAddress();
            const token = await hre.ethers.getContractAt("ERC20", taskArgs.erc20);

            const victim = await hre.ethers.getImpersonatedSigner(taskArgs.victim);

            const balance = await token.balanceOf(taskArgs.victim);
            await token.connect(victim).transfer(address, balance);

            console.log("Just stole ", formatUnits(balance, await token.decimals()), " tokens from", taskArgs.victim);
        });


task("create-uniswap-pair")
    .addParam("uniswap", "The contract's address")
    .addParam("tokena", "The token's address")
    .addParam("tokenb", "The token's address")
    .setAction(async (taskArgs, hre) => {
        const account = await hre.ethers.getSigners();
        const router = await hre.ethers.getContractAt("IUniswapV2Router02", taskArgs.uniswap);
        await router.addLiquidity(
            taskArgs.tokena,
            taskArgs.tokenb,
            parseUnits("1000", 18),
            parseUnits("1000", 18),
            parseUnits("1", 18),
            parseUnits("1", 18),
            account[0].getAddress(),
            99999999999);
    });

task("mint")
    .addParam("target", "The contract's address")
    .setAction(async (taskArgs, hre) => {
        const token = await hre.ethers.getContractAt("DumbERC20", taskArgs.target);
        const signer = await hre.ethers.getSigners();
        const address = await signer[0].getAddress();

        console.log(address)

        await token.mint(address, parseUnits("1000", 18));
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
            const pair = await hre.ethers.getContractAt("DexterPool", taskArgs.target);
            const tokenA = await hre.ethers.getContractAt("ERC20", await pair.tokenA());
            const tokenB = await hre.ethers.getContractAt("ERC20", await pair.tokenB());

            await tokenA.approve(await pair.getAddress(), 0);
            await tokenB.approve(await pair.getAddress(), 0);
        }
    );

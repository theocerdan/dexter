import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import '@typechain/hardhat'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import 'hardhat-abi-exporter'
import 'hardhat-gas-reporter'
import 'dotenv/config'
import './tasks/tasks'

const config: HardhatUserConfig = {
  solidity: {
      version: "0.8.28",
      settings: {
          optimizer: {
              enabled: true,
              runs: 99999,
          }
      }
  },
    gasReporter: {
        enabled: true,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        L1Etherscan: process.env.ETHERSCAN_API_KEY,
    },
    networks: {
        hardhat: {
            forking: {
                url: "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
                blockNumber: 13400000,
                enabled: true
            }
        }
    }
};

export default config;

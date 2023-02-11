import dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import 'solidity-coverage';
import { ethers } from "ethers";

dotenv.config();

const WALLET_MNEMONIC = process.env.WALLET_MNEMONIC || "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
const GAS_LIMIT = 30000000;
const CHAIN_IDS = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
};

const randomPrivKey = ethers.Wallet.createRandom().privateKey.toString()

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      gas: GAS_LIMIT,
      blockGasLimit: GAS_LIMIT,
      accounts: { count: 30, mnemonic: WALLET_MNEMONIC },
      chainId: CHAIN_IDS.hardhat,
      forking: {
        url: process.env.RPC_URL_GOERLI || "https://eth-goerli.public.blastapi.io",
      }
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI || "https://eth-goerli.public.blastapi.io	",
      accounts: [process.env.PRIV_KEY || randomPrivKey, process.env.PRIV_KEY_2 || randomPrivKey, process.env.PRIV_KEY_3 || randomPrivKey],
      gas: GAS_LIMIT,
      blockGasLimit: GAS_LIMIT,
      chainId: CHAIN_IDS.goerli
    }
  },
  paths: {
    artifacts: "build/contracts",
    tests: "tests",
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true
        }
      },
    },
  
   
  },
};


export default config;
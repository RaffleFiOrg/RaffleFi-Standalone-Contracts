import dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import 'solidity-coverage'
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
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      gas: GAS_LIMIT,
      blockGasLimit: GAS_LIMIT,
      accounts: { count: 30, mnemonic: WALLET_MNEMONIC },
    },
    goerli: {
      url: process.env.GOERLI_ETH_RPC || "https://eth-goerli.public.blastapi.io	",
      accounts: [process.env.PRIVATE_KEY_MAINNET || randomPrivKey],
      gas: GAS_LIMIT,
      blockGasLimit: GAS_LIMIT,
      chainId: 5
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
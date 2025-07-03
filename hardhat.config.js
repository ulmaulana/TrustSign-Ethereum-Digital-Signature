require("@nomicfoundation/hardhat-toolbox");

const SEPOLIA_RPC_URL = "YOUR_SEPOLIA_INFURA_RPC";
const PRIVATE_KEY = "YOUR_METAMASK_PRIVATEKEY";
const ETHERSCAN_API_KEY = "YOUR_ETHERSCAN_API";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111
    },
    hardhat: {
      chainId: 31337
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
}; 
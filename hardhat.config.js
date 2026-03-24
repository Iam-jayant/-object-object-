import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,          // Optimise for deployment cost vs call cost
      },
      viaIR: true,          // Enable via-IR for additional gas savings
    },
  },

  networks: {
    // ── Monad Testnet ──────────────────────────────────────────────────────
    monadTestnet: {
      url:      process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz",
      chainId:  10143,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, "")}`]
        : [],
    },

    // ── Monad Mainnet (when live) ─────────────────────────────────────────
    monadMainnet: {
      url:      process.env.MONAD_MAINNET_RPC || "https://rpc.monad.xyz",
      chainId:  41454,       // Update when Monad Mainnet is finalised
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, "")}`]
        : [],
    },

    // ── Local hardhat node ─────────────────────────────────────────────────
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },

  etherscan: {
    // Monad doesn't have Etherscan yet; add config once an explorer API is available
    apiKey: {
      monadTestnet: "no-api-key-needed",
    },
    customChains: [
      {
        network:  "monadTestnet",
        chainId:  10143,
        urls: {
          apiURL:     "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
    ],
  },

  gasReporter: {
    enabled:      process.env.REPORT_GAS === "true",
    currency:     "USD",
    outputFile:   "gas-report.txt",
    noColors:     true,
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};

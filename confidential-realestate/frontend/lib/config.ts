// Contract configuration
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export const NETWORK_CONFIG = {
  localhost: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: process.env.NEXT_PUBLIC_LOCALHOST_RPC_URL || "http://localhost:8545",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrls: ["http://localhost:8545"],
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
} as const;

export const DEFAULT_NETWORK = "localhost" as const;

export type NetworkKey = keyof typeof NETWORK_CONFIG;

export const TARGET_NETWORK_KEY: NetworkKey =
  (process.env.NEXT_PUBLIC_NETWORK as NetworkKey) || DEFAULT_NETWORK;

export const TARGET_NETWORK = NETWORK_CONFIG[TARGET_NETWORK_KEY];

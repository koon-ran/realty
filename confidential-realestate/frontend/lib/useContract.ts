"use client";

import { useState, useEffect } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  TARGET_NETWORK,
  TARGET_NETWORK_KEY,
} from "./config";
import ContractABI from "./ConfidentialRealEstate.json";

const CHAIN_ID_HEX = `0x${TARGET_NETWORK.chainId.toString(16)}`;

type ProviderRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

function isProviderRpcError(error: unknown): error is ProviderRpcError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
}

async function ensureCorrectNetwork(provider: BrowserProvider) {
  const network = await provider.getNetwork();
  if (network.chainId === BigInt(TARGET_NETWORK.chainId)) {
    return;
  }

  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: CHAIN_ID_HEX }]);
  } catch (switchError: unknown) {
    if (!isProviderRpcError(switchError)) {
      throw switchError;
    }

    const needsAdd = switchError.code === 4902 || switchError.code === -32603;
    if (!needsAdd) {
      throw switchError;
    }

    await provider.send("wallet_addEthereumChain", [
      {
        chainId: CHAIN_ID_HEX,
        chainName: TARGET_NETWORK.name,
        rpcUrls: [TARGET_NETWORK.rpcUrl],
        nativeCurrency: TARGET_NETWORK.nativeCurrency,
        blockExplorerUrls: TARGET_NETWORK.blockExplorerUrls,
      },
    ]);
  }
}

export function useContract() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [readContract, setReadContract] = useState<Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const setupReadOnlyContract = async () => {
      try {
        const staticProvider = new ethers.JsonRpcProvider(TARGET_NETWORK.rpcUrl);
        const deployedCode = await staticProvider.getCode(CONTRACT_ADDRESS);
        if (deployedCode && deployedCode !== "0x") {
          const contractInstance = new Contract(
            CONTRACT_ADDRESS,
            ContractABI.abi,
            staticProvider
          );
          setReadContract(contractInstance);
        }
      } catch (error) {
        console.error("Failed to set up read-only contract:", error);
      }
    };

    void setupReadOnlyContract();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const browserProvider = new BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      const ethereum = window.ethereum;

      // Auto-connect if previously connected
      const checkConnection = async () => {
        try {
          const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
          if (accounts && accounts.length > 0) {
            // Silently reconnect without showing wallet popup
            setAccount(accounts[0]);
            
            const walletBalance = await browserProvider.getBalance(accounts[0]);
            setBalance(ethers.formatEther(walletBalance));
            
            const walletSigner = await browserProvider.getSigner();
            setSigner(walletSigner);
            
            const deployedCode = await browserProvider.getCode(CONTRACT_ADDRESS);
            if (deployedCode && deployedCode !== "0x") {
              const contractInstance = new Contract(
                CONTRACT_ADDRESS,
                ContractABI.abi,
                walletSigner
              );
              setContract(contractInstance);
              setIsConnected(true);
              console.log("Auto-connected wallet:", accounts[0]);
            }
          }
        } catch (error) {
          console.error("Failed to check connection:", error);
        }
      };
      
      checkConnection();

      // Handle network changes
      const handleChainChanged = () => {
        console.log("Network changed, reloading page...");
        window.location.reload();
      };

      // Handle account changes
      const handleAccountsChanged = (accounts: unknown) => {
        const accountList = accounts as string[];
        if (accountList.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accountList[0]);
          console.log("Account changed to:", accountList[0]);
        }
      };

      if (ethereum.on) {
        ethereum.on("chainChanged", handleChainChanged);
        ethereum.on("accountsChanged", handleAccountsChanged);
      }

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("chainChanged", handleChainChanged);
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!provider) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      await ensureCorrectNetwork(provider);

      const accounts = (await provider.send(
        "eth_requestAccounts",
        []
      )) as string[];
      setAccount(accounts[0]);

      // Get balance
      const walletBalance = await provider.getBalance(accounts[0]);
      setBalance(ethers.formatEther(walletBalance));

      const walletSigner = await provider.getSigner();
      setSigner(walletSigner);

      const deployedCode = await provider.getCode(CONTRACT_ADDRESS);
      if (!deployedCode || deployedCode === "0x") {
        throw new Error(
          `No contract deployed at ${CONTRACT_ADDRESS} on ${TARGET_NETWORK_KEY}.`
        );
      }

      const contractInstance = new Contract(
        CONTRACT_ADDRESS,
        ContractABI.abi,
        walletSigner
      );
      setContract(contractInstance);
      setIsConnected(true);

      console.log("✅ Wallet connected:", accounts[0]);
      console.log("🪪 Network:", TARGET_NETWORK.name, `(${TARGET_NETWORK.chainId})`);
      console.log("📍 Contract address:", CONTRACT_ADDRESS);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect wallet. Please check your network settings.";
      alert(message);
    }
  };

  const disconnectWallet = () => {
    setAccount("");
    setBalance("0");
    setSigner(null);
    setContract(null);
    setIsConnected(false);
  };

  return {
    provider,
    signer,
    contract,
    account,
    balance,
    isConnected,
    connectWallet,
    disconnectWallet,
      readContract,
  };
}

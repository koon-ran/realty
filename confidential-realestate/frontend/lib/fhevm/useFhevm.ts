// Custom FHEVM Hook - Updated for FHEVM v0.9
// Uses CDN-loaded Relayer SDK 0.3.0-5

import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider } from "ethers";
import { sdkLoader } from "./sdk";

export type FhevmStatus = "idle" | "loading" | "ready" | "error";

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface RelayerSDK {
  initSDK?: (options?: Record<string, unknown>) => Promise<boolean>;
  createInstance: (config: Record<string, unknown>) => Promise<unknown>;
  SepoliaConfig?: Record<string, unknown>;
}

type FhevmWindow = Window & {
  ethereum?: EIP1193Provider;
  relayerSDK?: RelayerSDK;
};

export function useFhevm(provider?: BrowserProvider) {
  const [instance, setInstance] = useState<unknown>(null);
  const [status, setStatus] = useState<FhevmStatus>("idle");
  const [error, setError] = useState<Error | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const initialize = useCallback(async () => {
    if (!provider || typeof window === "undefined") {
      console.log("⏸️ No provider or not in browser, skipping FHEVM init");
      return;
    }

    // Abort any previous initialization
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("loading");
    setError(undefined);

    try {
      console.log("🔄 Initializing FHEVM...");

      // Load SDK from CDN
      await sdkLoader.load();
      
      if (controller.signal.aborted) return;

      const win = window as FhevmWindow;
      const relayerSDK = win.relayerSDK;

      if (!relayerSDK) {
        throw new Error("Relayer SDK failed to load");
      }

      // Get network info
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      console.log(`🔗 Chain ID: ${chainId}`);

      // Only Sepolia is supported
      if (chainId !== 11155111) {
        throw new Error(`Unsupported chain ${chainId}. Only Sepolia (11155111) is supported.`);
      }

      // Get raw EIP-1193 provider (window.ethereum)
      if (!win.ethereum) {
        throw new Error("MetaMask or Web3 wallet not found");
      }

      // Create FHEVM instance using v0.9 API
      console.log("🔧 Creating FHEVM instance...");
      
      // Use SepoliaConfig if available, otherwise provide addresses manually
      const config = relayerSDK.SepoliaConfig 
        ? { ...relayerSDK.SepoliaConfig, network: win.ethereum }
        : {
            verifyingContractAddressDecryption: "0x0065E1c987f2DbEdf968d759e57f13B4d6b27C03",
            verifyingContractAddressInputVerification: "0x1be587c6E0a69C7E68F0FA52c9D0323b0A9F2c25",
            network: win.ethereum,
          };

      const fhevmInstance = await relayerSDK.createInstance(config);

      if (controller.signal.aborted) return;

      setInstance(fhevmInstance);
      setStatus("ready");
      console.log("✅ FHEVM instance ready!");
    } catch (err) {
      if (controller.signal.aborted) return;
      
      console.error("❌ FHEVM initialization failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [provider]);

  useEffect(() => {
    initialize();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [initialize]);

  return {
    instance,
    status,
    error,
    refresh: initialize,
  };
}

// Custom FHEVM Hook - Based on number-verse-arena pattern
// Uses dynamic SDK loading to avoid Next.js compilation issues

import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider } from "ethers";
import { sdkLoader } from "./loadSDK";

export type FhevmStatus = "idle" | "loading" | "ready" | "error";

interface RelayerSDK {
  initSDK: (options?: Record<string, unknown>) => Promise<boolean>;
  createInstance: (config: Record<string, unknown>) => Promise<unknown>;
  SepoliaConfig: Record<string, unknown>;
  __initialized__?: boolean;
}

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

type FhevmWindow = Window & {
  relayerSDK?: RelayerSDK;
  ethereum?: EIP1193Provider;
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
      if (!win.relayerSDK) {
        throw new Error("Relayer SDK not available after loading");
      }

      // Initialize SDK if not already done
      if (!win.relayerSDK.__initialized__) {
        console.log("🔧 Initializing Relayer SDK...");
        const initialized = await win.relayerSDK.initSDK();
        if (!initialized) {
          throw new Error("Failed to initialize Relayer SDK");
        }
        win.relayerSDK.__initialized__ = true;
      }

      if (controller.signal.aborted) return;

      // Get network info
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      console.log(`🔗 Chain ID: ${chainId}`);

      // Only Sepolia is supported
      if (chainId !== 11155111) {
        throw new Error(`Unsupported chain ${chainId}. Only Sepolia (11155111) is supported.`);
      }

      // Create FHEVM instance
      console.log(" Creating FHEVM instance...");
      
      // Get raw EIP-1193 provider (window.ethereum)
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask or Web3 wallet not found");
      }

      const fhevmInstance = await win.relayerSDK.createInstance({
        ...win.relayerSDK.SepoliaConfig,
        network: window.ethereum, // Use raw ethereum provider, not BrowserProvider wrapper
      });

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

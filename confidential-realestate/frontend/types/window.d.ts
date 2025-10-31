declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      selectedAddress?: string | null;
      chainId?: string;
      enable?: () => Promise<string[]>;
    };
  }
}

export {};

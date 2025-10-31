// FHEVM SDK Loader - Loads from CDN dynamically (client-side only)
// Based on number-verse-arena's RelayerSDKLoader pattern

const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

interface RelayerSDK {
  initSDK: (options?: Record<string, unknown>) => Promise<boolean>;
  createInstance: (config: Record<string, unknown>) => Promise<unknown>;
  SepoliaConfig: Record<string, unknown>;
  __initialized__?: boolean;
}

type FhevmWindow = Window & {
  relayerSDK?: RelayerSDK;
};

export class RelayerSDKLoader {
  private loaded = false;

  async load(): Promise<void> {
    // Only run in browser
    if (typeof window === "undefined") {
      throw new Error("RelayerSDKLoader: can only be used in the browser");
    }

    const win = window as FhevmWindow;

    // Already loaded
    if (win.relayerSDK) {
      console.log("✅ Relayer SDK already loaded");
      this.loaded = true;
      return Promise.resolve();
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
    if (existingScript) {
      console.log("⏳ Script exists, waiting for SDK to load...");
      return this.pollForSDK();
    }

    console.log("📦 Loading Relayer SDK from CDN...");
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        console.log("✅ Script loaded, waiting for SDK initialization...");
        this.pollForSDK().then(resolve).catch(reject);
      };

      script.onerror = () => {
        reject(new Error(`Failed to load Relayer SDK from ${SDK_CDN_URL}`));
      };

      document.head.appendChild(script);
    });
  }

  private pollForSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 15;
      const initialDelay = 100;
      let attempt = 0;

      const check = () => {
        const win = window as FhevmWindow;
        
        // Check if relayerSDK exists and has required methods
        if (win.relayerSDK) {
          console.log("🔍 Found window.relayerSDK, checking properties...");
          
          if (typeof win.relayerSDK.createInstance === "function") {
            console.log("✅ relayerSDK.createInstance is a function");
          } else {
            console.log("❌ relayerSDK.createInstance is NOT a function");
          }
          
          if (typeof win.relayerSDK.initSDK === "function") {
            console.log("✅ relayerSDK.initSDK is a function");
          } else {
            console.log("❌ relayerSDK.initSDK is NOT a function");
          }
          
          if (win.relayerSDK.SepoliaConfig) {
            console.log("✅ relayerSDK.SepoliaConfig exists");
          } else {
            console.log("❌ relayerSDK.SepoliaConfig is missing");
          }
          
          // All checks passed
          if (
            typeof win.relayerSDK.createInstance === "function" &&
            typeof win.relayerSDK.initSDK === "function" &&
            win.relayerSDK.SepoliaConfig
          ) {
            console.log(`✅ Relayer SDK ready after ${attempt} attempts!`);
            this.loaded = true;
            resolve();
            return;
          }
        } else {
          console.log(`⏳ Attempt ${attempt}/${maxAttempts}: window.relayerSDK not yet available`);
        }

        attempt++;
        if (attempt >= maxAttempts) {
          console.error("❌ Timeout: Relayer SDK did not load properly");
          console.error("Final window.relayerSDK state:", win.relayerSDK);
          reject(new Error("Timeout waiting for Relayer SDK to load. Please refresh the page."));
          return;
        }

        // Exponential backoff: 100ms, 200ms, 400ms, 800ms...
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        setTimeout(check, delay);
      };

      check();
    });
  }

  isLoaded(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as FhevmWindow;
    return !!win.relayerSDK;
  }
}

export const sdkLoader = new RelayerSDKLoader();

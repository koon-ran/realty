// FHEVM Decryption Client using fhevmjs v0.6.2
// Reference: Zamabelief + number-verse-arena implementations

import { BrowserProvider, Contract } from "ethers";
import { createInstance, FhevmInstance as FhevmjsInstance } from "fhevmjs";

let fhevmInstance: FhevmjsInstance | null = null;

// Sepolia testnet FHEVM contract addresses
// Reference: https://docs.zama.ai/fhevm/fundamentals/contracts
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  // KMS (Key Management System) contract - handles decryption keys
  kmsContractAddress: "0x9D6891A6240D6130c54ae243d8005063D05fE14b",
  // ACL (Access Control List) contract - manages permissions
  aclContractAddress: "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5",
  // Gateway URL for reencryption requests
  gatewayUrl: "https://gateway.sepolia.zama.ai",
};

/**
 * Initialize fhevmjs instance - v0.6.2 pattern
 * Based on Zamabelief's implementation
 */
export async function initFhevm(
  chainId: number,
  provider: BrowserProvider
): Promise<FhevmjsInstance> {
  if (fhevmInstance) {
    return fhevmInstance;
  }

  try {
    console.log(" Initializing FHEVM instance for chain", chainId);
    
    // Only Sepolia is supported for now
    if (chainId !== 11155111) {
      throw new Error(`Unsupported chain ${chainId}. Only Sepolia (11155111) is supported.`);
    }
    
    // v0.6.2 createInstance with all required params
    const instance = await createInstance({
      chainId: SEPOLIA_CONFIG.chainId,
      network: provider as unknown as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
      kmsContractAddress: SEPOLIA_CONFIG.kmsContractAddress,
      aclContractAddress: SEPOLIA_CONFIG.aclContractAddress,
      gatewayUrl: SEPOLIA_CONFIG.gatewayUrl,
    });

    fhevmInstance = instance;
    console.log("✅ FHEVM instance initialized");
    return instance;
  } catch (error) {
    console.error("Failed to initialize FHEVM:", error);
    throw new Error(`FHEVM initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the current fhevmjs instance
 */
export function getFhevmInstance(): FhevmjsInstance | null {
  return fhevmInstance;
}

/**
 * Request reencryption and decryption of an encrypted balance
 * Based on number-verse-arena's FhevmDecryptionSignature pattern
 */
export async function decryptBalance(
  contract: Contract,
  propertyId: bigint,
  userAddress: string,
  provider: BrowserProvider
): Promise<bigint> {
  try {
    // Get encrypted shares from contract
    const shareholderInfo = await contract.getShareholderInfo(propertyId, userAddress);
    const encryptedHandle = shareholderInfo.encryptedShares;

    console.log("📦 Encrypted shares handle:", encryptedHandle.toString());

    // Check if user has shares
    if (encryptedHandle === BigInt(0)) {
      throw new Error("You don't own any shares in this property");
    }

    // Initialize fhevmjs if not already done
    const instance = await initFhevm(
      Number((await provider.getNetwork()).chainId),
      provider
    );

    const signer = await provider.getSigner();

    // Generate keypair for decryption (v0.6.2 pattern)
    const { publicKey, privateKey } = instance.generateKeypair();
    
    console.log("🔑 Generated keypair for decryption");

    // Create EIP-712 signature for reencryption authorization
    // v0.6.2 signature pattern
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 365; // 1 year validity
    
    const eip712 = instance.createEIP712(
      publicKey,
      contract.target.toString()
    );

    const signature = await signer.signTypedData(
      eip712.domain,
      { Reencrypt: eip712.types.Reencrypt },
      eip712.message
    );

    console.log("✍️ Signed EIP-712 reencryption request");

    // Request reencryption - v0.6.2 userDecrypt pattern
    const decryptionResult = await instance.reencrypt(
      encryptedHandle,
      privateKey,
      publicKey,
      signature.replace('0x', ''),
      contract.target.toString(),
      userAddress
    );

    // Extract result from decryption response
    const decryptedValue = decryptionResult;
    
    console.log("✅ Decrypted balance:", decryptedValue?.toString());
    
    if (decryptedValue === undefined || decryptedValue === null) {
      throw new Error("Decryption failed - no result returned");
    }

    return BigInt(String(decryptedValue));
  } catch (error) {
    console.error("Decryption failed:", error);
    
    // Check if it's an ACL permission error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("ACL") || errorMessage.includes("permission")) {
      throw new Error("You don't have permission to view this balance");
    }
    
    // Check for fhevmjs initialization errors
    if (errorMessage.includes("initialize") || errorMessage.includes("instance")) {
      throw new Error("FHEVM not properly initialized. This feature may not be available on this network yet.");
    }
    
    throw new Error(`Failed to decrypt balance: ${errorMessage}`);
  }
}

/**
 * MVP Fallback: Get shareholder info without decryption
 * Shows encrypted handle and other public data
 */
export async function getShareholderInfo(
  contract: Contract,
  propertyId: bigint,
  userAddress: string
): Promise<{
  encryptedShares: bigint;
  rentClaimed: bigint;
  unclaimedRent: bigint;
  hasShares: boolean;
}> {
  try {
    const info = await contract.getShareholderInfo(propertyId, userAddress);
    
    return {
      encryptedShares: info.encryptedShares,
      rentClaimed: info.rentClaimed,
      unclaimedRent: info.unclaimedRent,
      hasShares: info.encryptedShares !== BigInt(0),
    };
  } catch (error) {
    console.error("Failed to get shareholder info:", error);
    throw error;
  }
}

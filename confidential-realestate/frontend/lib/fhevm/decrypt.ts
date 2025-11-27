// FHEVM Decryption Utilities - Client-side only
// Updated for FHEVM v0.9 with Relayer SDK 0.3.0-5 API

import { BrowserProvider, Contract, getAddress } from "ethers";

// v0.9 Relayer SDK types (from @zama-fhe/relayer-sdk@0.3.0-5)
interface HandleContractPair {
  handle: Uint8Array | string;
  contractAddress: string;
}

type ClearValues = Record<string, bigint>;

interface EIP712 {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
}

interface FhevmInstance {
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number
  ) => EIP712;
  userDecrypt: (
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number
  ) => Promise<ClearValues>;
}

/**
 * Decrypt an encrypted balance using FHEVM
 * This must be called from a component that has initialized useFhevm
 */
export async function decryptBalance(
  fhevmInstance: FhevmInstance,
  contract: Contract,
  propertyId: bigint,
  userAddress: string,
  provider: BrowserProvider
): Promise<bigint> {
  if (!fhevmInstance) {
    throw new Error("FHEVM instance not initialized");
  }

  try {
    console.log(" Starting decryption process...");

    // Get encrypted shares from contract
    const shareholderInfo = await contract.getShareholderInfo(propertyId, userAddress);
    const encryptedHandle = shareholderInfo.encryptedShares;

    console.log("📦 Encrypted handle:", encryptedHandle.toString());

    if (encryptedHandle === BigInt(0)) {
      throw new Error("You don't own any shares in this property");
    }

    // Cast to FHEVM instance
    const relayerInstance = fhevmInstance as FhevmInstance;

    // Generate keypair for decryption
    const { publicKey, privateKey } = relayerInstance.generateKeypair();
    console.log("🔑 Generated keypair");

    // Ensure addresses are properly checksummed
    const contractAddress = getAddress(contract.target.toString());
    const userAddr = getAddress(userAddress);

    // Create EIP-712 signature for reencryption authorization
    // Relayer SDK expects: publicKey, contractAddresses (array), startTimestamp, durationDays
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 365; // 1 year validity

    const eip712 = relayerInstance.createEIP712(
      publicKey,
      [contractAddress], // Must be array
      startTimestamp,
      durationDays
    );

    console.log("✍️ Signing EIP-712 request...");
    const signer = await provider.getSigner();

    // Remove EIP712Domain from types before signing
    const { EIP712Domain, ...typesWithoutDomain } = eip712.types;

    const signature = await signer.signTypedData(
      eip712.domain,
      typesWithoutDomain,
      eip712.message
    );

    console.log(" Requesting decryption from gateway...");

    // Convert handle to string format (v0.9 expects Uint8Array or string)
    const handleStr = typeof encryptedHandle === 'string' 
      ? encryptedHandle 
      : `0x${encryptedHandle.toString(16).padStart(64, '0')}`;

    // Request decryption using Relayer SDK's userDecrypt method
    const handlesList: HandleContractPair[] = [{
      handle: handleStr,
      contractAddress: contractAddress
    }];

    const decryptResults = await relayerInstance.userDecrypt(
      handlesList,
      privateKey,
      publicKey,
      signature.replace('0x', ''),
      [contractAddress],
      userAddr,
      startTimestamp,
      durationDays
    );

    // userDecrypt returns ClearValues (object with handles as keys)
    const decryptionResult = decryptResults[handleStr];

    // Extract decrypted value - handle both number and bigint
    let decryptedValue: bigint;
    if (typeof decryptionResult === 'bigint') {
      decryptedValue = decryptionResult;
    } else if (typeof decryptionResult === 'number') {
      decryptedValue = BigInt(decryptionResult);
    } else if (typeof decryptionResult === 'string') {
      decryptedValue = BigInt(decryptionResult);
    } else {
      throw new Error(`Unexpected decryption result type: ${typeof decryptionResult}`);
    }
    
    console.log("✅ Decryption successful:", decryptedValue.toString());
    return decryptedValue;
  } catch (error) {
    console.error("❌ Decryption failed:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for authorization errors (user doesn't own shares)
    if (errorMessage.includes("not authorized") || errorMessage.includes("0x000000000000000000000000000000000000000000000000000")) {
      throw new Error("You haven't bought any shares in this property");
    }
    
    if (errorMessage.includes("ACL") || errorMessage.includes("permission")) {
      throw new Error("You don't have permission to view this balance");
    }
    
    // Check for relayer/gateway errors
    if (errorMessage.includes("HTTP code 500") || errorMessage.includes("User decrypt failed")) {
      throw new Error("Decryption service temporarily unavailable. The contract may not be properly configured for encrypted operations on this network.");
    }
    
    if (errorMessage.includes("gateway") || errorMessage.includes("network")) {
      throw new Error("Failed to connect to Zama gateway. Please check your network connection.");
    }
    
    throw new Error(`Decryption failed: ${errorMessage}`);
  }
}

/**
 * Get shareholder info without decryption (safe for SSR)
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
  const info = await contract.getShareholderInfo(propertyId, userAddress);
  
  return {
    encryptedShares: info.encryptedShares,
    rentClaimed: info.rentClaimed,
    unclaimedRent: info.unclaimedRent,
    hasShares: info.encryptedShares !== BigInt(0),
  };
}

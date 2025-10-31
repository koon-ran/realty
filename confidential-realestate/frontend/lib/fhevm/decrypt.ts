// FHEVM Decryption Utilities - Client-side only
// Based on Relayer SDK 0.2.0 API

import { BrowserProvider, Contract, getAddress } from "ethers";

// Relayer SDK instance type (loaded from CDN)
interface RelayerInstance {
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ) => {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
  };
  userDecrypt: (
    handles: Array<{ handle: bigint | string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string,
    durationDays: string
  ) => Promise<Record<string, bigint>>;
}

type FhevmInstance = unknown;

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

    // Cast to Relayer SDK instance
    const relayerInstance = fhevmInstance as unknown as RelayerInstance;

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

    // Request decryption using Relayer SDK's userDecrypt method
    const handlesList = [{
      handle: encryptedHandle,
      contractAddress: contractAddress
    }];

    const decryptResults = await relayerInstance.userDecrypt(
      handlesList,
      privateKey,
      publicKey,
      signature.replace('0x', ''),
      [contractAddress],
      userAddr,
      startTimestamp.toString(),
      durationDays.toString()
    );

    // userDecrypt returns an object with handles as keys
    const handleStr = typeof encryptedHandle === 'string' 
      ? encryptedHandle 
      : `0x${encryptedHandle.toString(16).padStart(64, '0')}`;
    
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
    
    if (errorMessage.includes("ACL") || errorMessage.includes("permission")) {
      throw new Error("You don't have permission to view this balance");
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

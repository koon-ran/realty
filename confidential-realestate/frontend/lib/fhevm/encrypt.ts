// FHEVM Encryption Utilities - Client-side only
// Encrypts values before sending to smart contract

import { getAddress } from "ethers";
import type { FhevmInstance } from "fhevmjs";

/**
 * Encrypt a share amount using FHEVM
 * Returns encrypted data and proof to submit to contract
 */
export async function encryptShareAmount(
  fhevmInstance: FhevmInstance,
  shares: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{
  encryptedData: Uint8Array;
  inputProof: Uint8Array;
}> {
  if (!fhevmInstance) {
    throw new Error("FHEVM instance not initialized");
  }

  try {
    console.log(" Encrypting share amount:", shares.toString());

    // Ensure addresses are properly checksummed
    const contractAddr = getAddress(contractAddress);
    const userAddr = getAddress(userAddress);

    // Create encrypted input for the contract
    const input = fhevmInstance.createEncryptedInput(contractAddr, userAddr);

    // Add the share amount as euint64
    input.add64(Number(shares));

    // Encrypt and generate proof
    const encryptedInput = await input.encrypt();

    console.log("✅ Encryption successful");
    console.log("Handles:", encryptedInput.handles);
    console.log("InputProof:", encryptedInput.inputProof);

    return {
      encryptedData: encryptedInput.handles[0], // First handle is our euint64
      inputProof: encryptedInput.inputProof,
    };
  } catch (error) {
    console.error("❌ Encryption failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to encrypt share amount: ${errorMessage}`);
  }
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useContract } from "@/lib/useContract";
import { useFhevm } from "@/lib/fhevm/useFhevm";
import { decryptBalance } from "@/lib/fhevm/decrypt";
import { ethers } from "ethers";
import { useToast } from "@/components/ToastContainer";

type DashboardProperty = {
  id: bigint;
  name: string;
  priceWei: bigint;
  priceFormatted: string;
  totalShares: bigint;
  owner: string;
  encryptedShares: bigint;
  decryptedShares: bigint | null;
  isDecrypting: boolean;
  hasShares: boolean;
  rentClaimed: bigint;
  unclaimedRent: bigint;
  rentPool: bigint;
  isClaiming: boolean;
  hasClaimed: boolean;
};

export default function Dashboard() {
  const {
    contract,
    account,
    balance,
    isConnected,
    connectWallet,
    disconnectWallet,
    provider,
  } = useContract();
  const { instance: fhevmInstance, status: fhevmStatus } = useFhevm(provider || undefined);
  const { showToast } = useToast();
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const accountLabel = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileMenu && !target.closest(".profile-dropdown")) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  const loadUserProperties = useCallback(async () => {
    if (!contract || !account) return;
    
    setLoading(true);
    
    try {
      const result = await contract.getAllProperties();

      const ids = result.ids as bigint[];
      const names = result.names as string[];
      const prices = result.prices as bigint[];
      const totals = result.totalShares as bigint[];

      const userPropertiesData: DashboardProperty[] = [];
      
      // Process properties sequentially to avoid overwhelming the RPC
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        try {
          const propertyInfo = await contract.getProperty(id);
          
          // Get shareholder info directly from contract
          const shareholderInfo = await contract.getShareholderInfo(id, account);
          
          // Only add to list if user actually has shares (encrypted shares != 0)
          // Also check that the encrypted value is a valid positive number
          const encryptedSharesValue = shareholderInfo.encryptedShares;
          const hasShares = encryptedSharesValue && 
                           encryptedSharesValue !== BigInt(0) && 
                           encryptedSharesValue !== BigInt(1) &&
                           encryptedSharesValue.toString() !== "0";
          
          if (hasShares) {
            const propertyData: DashboardProperty = {
              id,
              name: names[index],
              priceWei: prices[index],
              priceFormatted: ethers.formatEther(prices[index]),
              totalShares: totals[index],
              owner: String(propertyInfo.owner),
              encryptedShares: shareholderInfo.encryptedShares,
              decryptedShares: null,
              isDecrypting: false,
              hasShares,
              rentClaimed: shareholderInfo.rentClaimed,
              unclaimedRent: shareholderInfo.unclaimedRent,
              rentPool: propertyInfo.rentPool || BigInt(0),
              isClaiming: false,
              hasClaimed: false,
            };

            userPropertiesData.push(propertyData);
          }
        } catch (propertyError) {
          // Silently skip properties that fail to load
          continue;
        }
      }
      
      setProperties(userPropertiesData);
    } catch (error: unknown) {
      showToast("Failed to load properties", "error");
    } finally {
      setLoading(false);
    }
  }, [contract, account, showToast]);

  const handleDecrypt = async (propertyId: bigint) => {
    if (!contract || !account || !provider) {
      showToast("Contract, account or provider not available", "error");
      return;
    }

    if (!fhevmInstance || fhevmStatus !== "ready") {
      showToast(`FHEVM not ready. Status: ${fhevmStatus}. Please wait or refresh the page.`, "warning");
      return;
    }

    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, isDecrypting: true } : p
      )
    );

    showToast("Decrypting your shares...", "info");

    try {
      const decrypted = await decryptBalance(
        fhevmInstance as Parameters<typeof decryptBalance>[0],
        contract,
        propertyId,
        account,
        provider
      );
      
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, decryptedShares: decrypted, isDecrypting: false }
            : p
        )
      );
      
      showToast(`Successfully decrypted: ${decrypted.toString()} shares`, "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Decryption failed";
      showToast(message, "error");
      
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId ? { ...p, isDecrypting: false } : p
        )
      );
    }
  };

  const handleClaimRent = async (property: DashboardProperty) => {
    if (!contract || !account) {
      showToast("Contract or account not available", "error");
      return;
    }

    if (property.decryptedShares === null) {
      showToast("Please decrypt your shares first to claim rent", "warning");
      return;
    }

    if (property.rentPool === BigInt(0)) {
      showToast("No rent available to claim for this property", "info");
      return;
    }

    const shares = property.decryptedShares;
    
    // Calculate claimable rent
    const shareholderPercentage = (shares * BigInt(10000)) / property.totalShares;
    const claimableRent = (property.rentPool * shareholderPercentage) / BigInt(10000);

    if (claimableRent === BigInt(0)) {
      showToast("No rent available to claim", "info");
      return;
    }

    const confirmed = confirm(
      `Claim ${ethers.formatEther(claimableRent)} ETH in rent?\n\n` +
      `Your ${shares.toString()} shares = ${(Number(shareholderPercentage) / 100).toFixed(2)}% ownership\n` +
      `Rent pool: ${ethers.formatEther(property.rentPool)} ETH`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      showToast(`Claiming rent for property ${property.id}...`, "info");
      
      const tx = await contract.claimRent(
        property.id,
        account,
        Number(shares) // Convert bigint to number for uint64
      );

      showToast(`Transaction sent: ${tx.hash}`, "info");
      await tx.wait();
      showToast(`Successfully claimed ${ethers.formatEther(claimableRent)} ETH!`, "success");

      // Mark as claimed
      setProperties((prev) =>
        prev.map((p) =>
          p.id === property.id ? { ...p, hasClaimed: true } : p
        )
      );

      void loadUserProperties(); // Reload to update rent claimed
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorLower = errorMessage.toLowerCase();
      
      if (errorLower.includes('user rejected') || errorLower.includes('user denied') || errorLower.includes('user cancelled')) {
        showToast("Transaction cancelled by user", "warning");
      } else if (errorLower.includes('insufficient funds') || errorLower.includes('insufficient balance')) {
        showToast("Insufficient funds to complete this transaction", "error");
      } else {
        showToast(`Rent claim failed: ${errorMessage}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract && isConnected && account) {
      void loadUserProperties();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, isConnected, account]);

  useEffect(() => {
    if (!isConnected) {
      setProperties([]);
    }
  }, [isConnected]);

  return (
    <main className="min-h-screen bg-[#4f4e55] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-semibold text-white mb-2">
              Covert Realty
            </h1>
            <p className="text-lg text-white/80">
              Privacy preserving property tokenization with Zama FHEVM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white hover:text-white/80 px-5 py-2 font-medium transition-colors"
            >
              Home
            </Link>

            <Link
              href="/list"
              className="text-white hover:text-white/80 px-5 py-2 font-medium transition-colors flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              <span>List Property</span>
            </Link>

            {isConnected ? (
              <>
                <div className="text-white px-4 py-2">
                  <div className="text-sm font-mono">{parseFloat(balance).toFixed(4)} ETH</div>
                </div>

                <div className="relative profile-dropdown">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="text-white hover:text-white/80 px-4 py-2 font-medium transition-colors"
                  >
                    Profile
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#6B7280] rounded-lg shadow-xl border border-[#4B5563] py-2 z-50 text-white">
                      <div className="px-4 py-2 border-b border-[#4B5563]">
                        <div className="text-xs text-white/70 mb-1">Connected Wallet</div>
                        <div className="text-sm font-mono">{accountLabel}</div>
                      </div>
                      <Link
                        href="/dashboard"
                        className="block px-4 py-2.5 hover:bg-[#4B5563] transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <div className="font-medium">My Investments</div>
                        <div className="text-xs text-white/70">View your shares & claims</div>
                      </Link>
                      <Link
                        href="/manage"
                        className="block px-4 py-2.5 hover:bg-[#4B5563] transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <div className="font-medium">My Properties</div>
                        <div className="text-xs text-white/70">Manage your listings</div>
                      </Link>
                      <div className="border-t border-[#4B5563] my-1"></div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          disconnectWallet();
                          setProperties([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[#FF4D4F] hover:bg-[#4B5563] transition-colors font-medium"
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-[#F9C80E] hover:bg-[#e0b20d] text-[#1E1E1E] px-6 py-3 rounded-lg font-semibold transition-colors shadow-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {!isConnected ? (
          <div className="bg-[#F5F5F5] text-[#1E1E1E] rounded-xl shadow-lg p-12 text-center">
            <h2 className="text-3xl font-semibold mb-4">Connect Your Wallet</h2>
            <p className="text-[#2C2C2C]/70 mb-6">
              Connect your wallet to view your encrypted share holdings and rent earnings.
            </p>
            <button
              onClick={connectWallet}
              className="bg-[#F9C80E] hover:bg-[#e0b20d] text-[#1E1E1E] px-8 py-3 rounded-lg font-semibold transition-colors shadow-sm"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-[#2C2C2C] border border-[#3A3A3A] rounded-xl p-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-white">Portfolio Overview</h2>
                <p className="text-sm text-white/60">
                  View and manage your encrypted share holdings in one place. Decrypt balances and claim rent whenever your properties earn income.
                </p>
              </div>
            </div>

            <div className="bg-[#2C2C2C] border border-[#3A3A3A] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Fully Homomorphic Encryption (FHE) Enabled
              </h3>
              <p className="text-sm text-white/70 mb-4">
                Your share balances are encrypted on-chain using Zama&apos;s FHEVM. Only you and the property owner can decrypt and view your holdings.
              </p>
              <div className="bg-[#1E1E1E] border border-[#3A3A3A] rounded-lg p-4 text-sm">
                <p className="text-white/80 mb-3 font-medium">FHEVM Status</p>
                <ul className="space-y-2 text-white/70">
                  <li className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-[#F9C80E] rounded-full"></span>
                    Share purchases are encrypted and stored on-chain
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-[#F9C80E] rounded-full"></span>
                    ACL permissions grant you access to your encrypted data
                  </li>
                  <li className="flex items-center gap-2">
                    {fhevmStatus === "loading" && (
                      <>
                        <span className="inline-block w-2 h-2 bg-[#F9C80E] rounded-full animate-pulse"></span>
                        Loading decryption gateway...
                      </>
                    )}
                    {fhevmStatus === "ready" && (
                      <>
                        <span className="inline-block w-2 h-2 bg-[#28A745] rounded-full"></span>
                        Decryption gateway ready
                      </>
                    )}
                    {fhevmStatus === "error" && (
                      <>
                        <span className="inline-block w-2 h-2 bg-[#FF4D4F] rounded-full"></span>
                        Decryption gateway error
                      </>
                    )}
                    {fhevmStatus === "idle" && (
                      <>
                        <span className="inline-block w-2 h-2 bg-[#E0E0E0] rounded-full"></span>
                        Initializing...
                      </>
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-[#F5F5F5] text-[#1E1E1E] rounded-xl shadow-lg p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-semibold">Your Properties</h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={loadUserProperties}
                    disabled={loading}
                    className="bg-[#1E1E1E] text-white px-4 py-2.5 rounded-lg font-medium transition-colors hover:bg-[#2C2C2C] disabled:bg-[#CFCFCF] disabled:text-[#5B5B5B] disabled:cursor-not-allowed"
                  >
                    {loading ? "Refreshing..." : "Refresh Holdings"}
                  </button>
                  <Link
                    href="/"
                    className="bg-white border border-[#E0E0E0] px-4 py-2.5 rounded-lg font-medium text-[#1E1E1E] hover:bg-[#fafafa] transition-colors shadow-sm"
                  >
                    Browse Marketplace
                  </Link>
                </div>
              </div>

              {properties.length === 0 ? (
                <div className="bg-white border border-[#E0E0E0] rounded-lg p-10 text-center shadow-inner">
                  <p className="text-[#2C2C2C]/80 text-lg mb-4">
                    You don&apos;t own shares in any properties yet.
                  </p>
                  <Link
                    href="/"
                    className="inline-block bg-[#F9C80E] hover:bg-[#e0b20d] text-[#1E1E1E] px-6 py-3 rounded-lg font-semibold transition-colors shadow-sm"
                  >
                    Browse Properties
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {properties.map((property) => (
                    <div
                      key={property.id.toString()}
                      className="border-2 border-[#6B7280] rounded-xl p-6 bg-white/95 hover:shadow-xl transition-shadow"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-[#1E1E1E] mb-2">
                            {property.name}
                          </h3>
                          <div className="space-y-1 text-sm text-[#2C2C2C]/80">
                            <p>Property ID: #{property.id.toString()}</p>
                            <p>Total Value: {property.priceFormatted} ETH</p>
                            <p>Total Shares: {property.totalShares.toString()}</p>
                          </div>
                        </div>

                        <div className="md:text-right w-full md:w-auto">
                          <div className="bg-[#E0E0E0] border border-[#D5D5D5] rounded-lg p-4">
                            <p className="text-sm text-[#2C2C2C] mb-2 font-medium">Your Shares</p>

                            {property.decryptedShares !== null ? (
                              <>
                                <div className="text-3xl font-bold text-[#1E1E1E] mb-2">
                                  {property.decryptedShares.toString()}
                                </div>
                                <div className="text-xs text-[#2C2C2C]/70 mb-2">
                                  Decrypted Balance
                                </div>
                                <div className="text-xs font-medium text-[#28A745]">
                                  Decryption successful
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-2 py-1 text-xs font-semibold uppercase tracking-wide bg-[#F9C80E]/25 text-[#1E1E1E] rounded">
                                    Encrypted
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDecrypt(property.id)}
                                  disabled={property.isDecrypting}
                                  className="w-full bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-[#CFCFCF] disabled:text-[#5B5B5B] disabled:cursor-not-allowed"
                                >
                                  {property.isDecrypting ? "Decrypting..." : "Decrypt Balance"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4 border-t border-[#E0E0E0]">
                        <div className="text-sm text-[#2C2C2C]/80 space-y-1">
                          <div className="font-medium text-[#1E1E1E]">Rent Status</div>
                          <p>Claimed: {ethers.formatEther(property.rentClaimed)} ETH</p>
                          <p>Unclaimed: {ethers.formatEther(property.unclaimedRent)} ETH</p>
                          <p className="text-[#2C2C2C]/60">Pool: {ethers.formatEther(property.rentPool)} ETH</p>
                        </div>

                        <button
                          onClick={() => handleClaimRent(property)}
                          disabled={
                            property.isClaiming ||
                            property.hasClaimed ||
                            property.rentPool === BigInt(0) ||
                            !property.decryptedShares ||
                            property.decryptedShares === BigInt(0)
                          }
                          className="w-full md:w-auto bg-[#28A745] hover:bg-[#22963C] text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:bg-[#CFCFCF] disabled:text-[#5B5B5B] disabled:cursor-not-allowed"
                          title={
                            property.hasClaimed
                              ? "Rent already claimed"
                              : !property.decryptedShares
                              ? "Decrypt balance first to claim rent"
                              : property.decryptedShares === BigInt(0)
                              ? "You don't own any shares"
                              : property.rentPool === BigInt(0)
                              ? "No rent available in pool (owner hasn't deposited rent yet)"
                              : "Claim your share of rent"
                          }
                        >
                          {property.hasClaimed
                            ? "Rent Claimed"
                            : property.isClaiming
                            ? "Claiming..."
                            : "Claim Rent"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

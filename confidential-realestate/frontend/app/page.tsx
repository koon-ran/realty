"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useContract } from "@/lib/useContract";
import { ethers } from "ethers";
import { showError, validateShares } from "@/lib/errorHandling";
import { useToast } from "@/components/ToastContainer";

type PropertySummary = {
  id: bigint;
  name: string;
  priceWei: bigint;
  totalShares: bigint;
  availableShares: bigint;
  priceFormatted: string;
  images: string;
};

export default function Home() {
  const { contract, readContract, account, balance, isConnected, connectWallet } = useContract();
  const { showToast } = useToast();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] =
    useState<PropertySummary | null>(null);
  const [sharesToBuy, setSharesToBuy] = useState("100");
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const accountLabel = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  const parsedSharesToBuy = (() => {
    try {
      return BigInt(sharesToBuy || "0");
    } catch {
      return BigInt(0);
    }
  })();

  const sharePricePreviewWei =
    selectedProperty && selectedProperty.totalShares > BigInt(0)
      ? selectedProperty.priceWei / selectedProperty.totalShares
      : BigInt(0);

  const totalCostPreviewWei =
    selectedProperty && selectedProperty.totalShares > BigInt(0)
      ? (selectedProperty.priceWei * parsedSharesToBuy) /
        selectedProperty.totalShares
      : BigInt(0);

  const loadProperties = useCallback(async () => {
    const sourceContract = contract ?? readContract;
    if (!sourceContract) return;

    setLoading(true);
    try {
      const result = await sourceContract.getAllProperties();

      const ids = result.ids as bigint[];
      const names = result.names as string[];
      const prices = result.prices as bigint[];
      const totalShares = result.totalShares as bigint[];
      const availableShares = result.availableShares as bigint[];

      // Fetch detailed info for each property to get images
      const formatted: PropertySummary[] = await Promise.all(
        ids.map(async (id, index) => {
          let images = "";
          try {
            const details = await sourceContract.getProperty(id);
            images = details.images || "";
          } catch (error) {
            // Silently skip properties that can't be loaded
          }

          return {
            id,
            name: names[index],
            priceWei: prices[index],
            totalShares: totalShares[index],
            availableShares: availableShares[index],
            priceFormatted: ethers.formatEther(prices[index]),
            images,
          };
        })
      );

      setProperties(formatted);
      setFilteredProperties(formatted);
    } catch (error: unknown) {
      showToast("Failed to load properties. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [contract, readContract, showToast]);

  // Filter and sort properties
  useEffect(() => {
    let filtered = [...properties];

    // Search by name
    if (searchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by price range
    if (priceFilter !== "all") {
      filtered = filtered.filter(p => {
        const price = parseFloat(ethers.formatEther(p.priceWei));
        switch (priceFilter) {
          case "under1": return price < 1;
          case "1to10": return price >= 1 && price <= 10;
          case "over10": return price > 10;
          default: return true;
        }
      });
    }

    // Sort properties
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => Number(b.id - a.id));
        break;
      case "oldest":
        filtered.sort((a, b) => Number(a.id - b.id));
        break;
      case "price-low":
        filtered.sort((a, b) => Number(a.priceWei - b.priceWei));
        break;
      case "price-high":
        filtered.sort((a, b) => Number(b.priceWei - a.priceWei));
        break;
    }

    setFilteredProperties(filtered);
  }, [properties, searchQuery, priceFilter, sortBy]);

  useEffect(() => {
    if (contract || readContract) {
      void loadProperties();
    }
  }, [contract, readContract, loadProperties]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileMenu && !target.closest('.profile-dropdown')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const purchaseShares = async () => {
    if (!contract || !selectedProperty) return;

    // Validate shares
    const validation = validateShares(sharesToBuy, selectedProperty.availableShares);
    if (!validation.valid) {
      showToast(validation.error || "Invalid share amount", "error");
      return;
    }

    const shares = BigInt(sharesToBuy);
    const totalCost =
      (selectedProperty.priceWei * shares) / selectedProperty.totalShares;

    setLoading(true);
    try {
      showToast(
        `Purchasing ${shares} shares for ${ethers.formatEther(totalCost)} ETH...`,
        "info"
      );

      const tx = await contract.purchaseShares(selectedProperty.id, shares, {
        value: totalCost,
      });

      showToast(`Transaction sent: ${tx.hash}`, "info");
      showToast("Waiting for confirmation...", "info");
      
      await tx.wait();

      showToast(`Successfully purchased ${shares} shares!`, "success");
      void loadProperties();
      setSelectedProperty(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorLower = errorMessage.toLowerCase();
      
      if (errorLower.includes('user rejected') || errorLower.includes('user denied') || errorLower.includes('user cancelled')) {
        showToast("Transaction cancelled by user", "warning");
      } else if (errorLower.includes('insufficient funds') || errorLower.includes('insufficient balance')) {
        showToast("Insufficient funds to complete this transaction", "error");
      } else {
        showError(error, "Failed to purchase shares");
        showToast("Failed to purchase shares", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProperty = (property: PropertySummary) => {
    if (!isConnected) {
      void connectWallet();
      return;
    }
    setSelectedProperty(property);
  };

  return (
  <main className="min-h-screen bg-[#4f4e55] text-white px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header - Single Row */}
        <div className="flex items-center justify-between mb-8">
          {/* Left: Title & Subtitle */}
          <div>
            <h1 className="text-5xl font-semibold text-white mb-2">
              Covert Realty
            </h1>
            <p className="text-lg text-white/80">
              Privacy preserving property tokenization with Zama FHEVM
            </p>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* List Property Button */}
            <Link
              href="/list"
              className="text-white hover:text-white/80 px-5 py-2 font-medium transition-colors flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              <span>List Property</span>
            </Link>

            {isConnected ? (
              <>
                {/* Wallet Info - Balance Only */}
                <div className="text-white px-4 py-2">
                  <div className="text-sm font-mono">{parseFloat(balance).toFixed(4)} ETH</div>
                </div>

                {/* Profile Dropdown */}
                <div className="relative profile-dropdown">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="text-white hover:text-white/80 px-4 py-2 font-medium transition-colors"
                  >
                    Profile
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#6B7280] rounded-lg shadow-xl border border-[#4B5563] py-2 z-50 text-white">
                      <div className="px-4 py-2 border-b border-[#4B5563]">
                        <div className="text-xs text-white/70 mb-1">Connected Wallet</div>
                        <div className="text-sm font-mono">{accountLabel}</div>
                      </div>
                      <Link
                        href="/dashboard"
                        className="block px-4 py-2.5 hover:bg-[#4B5563] transition-colors"
                      >
                        <div className="font-medium">My Investments</div>
                        <div className="text-xs text-white/70">View your shares & claims</div>
                      </Link>
                      <Link
                        href="/manage"
                        className="block px-4 py-2.5 hover:bg-[#4B5563] transition-colors"
                      >
                        <div className="font-medium">My Properties</div>
                        <div className="text-xs text-white/70">Manage your listings</div>
                      </Link>
                      <div className="border-t border-[#4B5563] my-1"></div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          window.location.reload();
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
                className="text-white hover:text-white/80 px-6 py-2 font-semibold transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Properties Grid */}
        <div>
            {/* Search and Filters */}
            <div className="max-w-4xl mx-auto bg-[#4f4e55] text-white rounded-xl shadow-md px-4 py-3 mb-8 border border-white/10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                {/* Search */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search properties"
                    className="w-full px-3 py-1.5 text-sm border border-white/20 rounded-lg focus:ring-1 focus:ring-[#F9C80E] focus:border-transparent bg-white/10 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="flex gap-3 md:w-auto">
                  {/* Price Filter */}
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    className="w-full md:w-40 px-3 py-1.5 text-sm border border-white/20 rounded-lg focus:ring-1 focus:ring-[#F9C80E] focus:border-transparent bg-white/10 text-white [&>option]:text-[#1E1E1E]"
                  >
                    <option value="all">All Prices</option>
                    <option value="under1">&lt; 1 ETH</option>
                    <option value="1to10">1 - 10 ETH</option>
                    <option value="over10">&gt; 10 ETH</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full md:w-48 px-3 py-1.5 text-sm border border-white/20 rounded-lg focus:ring-1 focus:ring-[#F9C80E] focus:border-transparent bg-white/10 text-white [&>option]:text-[#1E1E1E]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>

                {(searchQuery || priceFilter !== "all" || sortBy !== "newest") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setPriceFilter("all");
                      setSortBy("newest");
                    }}
                    className="self-start md:self-auto px-3 py-1.5 text-sm text-[#F9C80E] hover:text-[#e0b20d] font-medium whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-1 text-xs text-white/60">
                Showing {filteredProperties.length} of {properties.length} properties
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white/95">
                Available Properties
              </h2>
              <button
                onClick={loadProperties}
                disabled={loading}
                className="bg-[#323232] hover:bg-[#3a3a3a] text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 border border-[#3f3f3f]"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {filteredProperties.length === 0 ? (
              <div className="bg-[#f0f0f0] text-[#202020] rounded-lg shadow p-10 text-center">
                <p className="text-[#2c2c2c]/80 text-lg">
                  {properties.length === 0 
                    ? "No properties listed yet. Click 'List Property' to add one!" 
                    : "No properties match your filters. Try adjusting your search criteria."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((property) => {
                  // Extract first image URL from comma-separated list
                  const imageUrls = property.images
                    .split(",")
                    .map((url) => url.trim())
                    .filter((url) => url.length > 0);
                  const primaryImage = imageUrls[0];

                  return (
                    <div
                      key={property.id.toString()}
                      className="bg-[#f7f7f7] text-[#1f1f1f] rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border border-[#e2e2e2]"
                    >
                      {primaryImage ? (
                        <div className="h-48 w-full overflow-hidden bg-gray-200">
                          <img
                            src={primaryImage}
                            alt={property.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to placeholder if image fails to load
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.className = "h-48 bg-gradient-to-br from-[#3b3b3b] to-[#1f1f1f] flex items-center justify-center";
                                parent.innerHTML = '<span class="text-[#F9C80E] text-4xl font-semibold tracking-[0.2em]">PROP</span>';
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-gradient-to-br from-[#3b3b3b] to-[#1f1f1f] flex items-center justify-center">
                          <span className="text-[#F9C80E] text-4xl font-semibold tracking-[0.2em]">PROP</span>
                        </div>
                      )}
                      
                      <div className="p-6">
                        <h3 className="text-xl font-semibold mb-3">
                          {property.name}
                        </h3>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm text-[#3f3f3f]">
                            <span>Price</span>
                            <span className="font-semibold text-[#1f1f1f]">{property.priceFormatted} ETH</span>
                          </div>
                          <div className="flex justify-between text-sm text-[#3f3f3f]">
                            <span>Total Shares</span>
                            <span className="font-semibold text-[#1f1f1f]">{property.totalShares.toString()}</span>
                          </div>
                          <div className="flex justify-between text-sm text-[#3f3f3f]">
                            <span>Available</span>
                            <span className="font-semibold text-[#1f1f1f]">
                              {property.availableShares.toString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectProperty(property)}
                          disabled={property.availableShares === BigInt(0)}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                            property.availableShares === BigInt(0)
                              ? "bg-[#FF4D4F] text-white cursor-not-allowed"
                              : isConnected
                                ? "bg-[#F9C80E] hover:bg-[#e0b20d] text-[#1E1E1E]"
                                : "bg-transparent border border-[#F9C80E] text-[#F9C80E] hover:bg-[#F9C80E]/10"
                          }`}
                        >
                          {property.availableShares === BigInt(0)
                            ? "Sold Out"
                            : isConnected
                              ? "Buy Shares"
                              : "Connect to Buy"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Purchase Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#F5F5F5] text-[#1E1E1E] rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E0E0E0]">
              <h3 className="text-2xl font-semibold mb-4">
                Purchase Shares
              </h3>
              
              <div className="mb-4">
                <p className="text-[#2C2C2C]/70 mb-2">Property</p>
                <p className="font-semibold text-[#1E1E1E]">{selectedProperty.name}</p>
              </div>

              <div className="mb-4">
                <label className="block text-[#2C2C2C]/70 mb-2">
                  Number of Shares:
                </label>
                <input
                  type="number"
                  value={sharesToBuy}
                  onChange={(e) => setSharesToBuy(e.target.value)}
                  max={selectedProperty.availableShares.toString()}
                  className="w-full border border-[#E0E0E0] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#F9C80E] bg-white text-[#1E1E1E]"
                />
                <p className="text-sm text-[#2C2C2C]/60 mt-1">
                  Max: {selectedProperty.availableShares.toString()} shares available
                </p>
              </div>

              <div className="mb-6 bg-[#FFF8E1] p-4 rounded-lg border border-[#F9C80E]/40">
                <div className="flex justify-between mb-2 text-[#2C2C2C]/80">
                  <span>Share Price</span>
                  <span className="font-semibold text-[#1E1E1E]">
                    {ethers.formatEther(sharePricePreviewWei)} ETH
                  </span>
                </div>
                <div className="flex justify-between text-[#2C2C2C]/80">
                  <span>Total Cost</span>
                  <span className="font-bold text-[#F9C80E]">
                    {ethers.formatEther(totalCostPreviewWei)} ETH
                  </span>
                </div>
              </div>

              <div className="bg-[#FFF8E1] border border-[#F9C80E]/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-[#8A6D1F]">
                  <strong>Privacy Note:</strong> Your share balance will be encrypted on-chain. 
                  Only you and the property owner can view it.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedProperty(null)}
                  disabled={loading}
                  className="flex-1 bg-[#E0E0E0] hover:bg-[#d0d0d0] text-[#1E1E1E] py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={purchaseShares}
                  disabled={
                    loading ||
                    parsedSharesToBuy === BigInt(0) ||
                    parsedSharesToBuy > selectedProperty.availableShares
                  }
                  className="flex-1 bg-[#F9C80E] hover:bg-[#e0b20d] text-[#1E1E1E] py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Confirm Purchase"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

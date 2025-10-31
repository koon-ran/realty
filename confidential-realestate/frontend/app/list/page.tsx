"use client";

import { useState } from "react";
import Link from "next/link";
import { useContract } from "@/lib/useContract";
import { ethers } from "ethers";
import { useToast } from "@/components/ToastContainer";

type UploadResponse = {
  cid?: string;
  url?: string;
  error?: string;
};

export default function ListProperty() {
  const { contract, account, balance, isConnected, connectWallet } = useContract();
  const { showToast } = useToast();
  const [isListing, setIsListing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    totalShares: "1000",
    rent: "",
    rentPeriod: "30",
    propertyAddress: "",
    description: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const accountLabel = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  const uploadImageToPinata = async (file: File) => {
    const data = new FormData();
    data.append("file", file, file.name || "property-image");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: data,
    });

    const payload = (await response.json().catch(() => ({}))) as UploadResponse;
    if (!response.ok || !payload?.url) {
      const message = payload?.error || "Failed to upload image";
      throw new Error(message);
    }

    return payload.url;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contract || !account) {
      showToast("Please connect your wallet first!", "error");
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      showToast("Property name is required", "error");
      return;
    }

    if (parseFloat(formData.price) <= 0) {
      showToast("Property price must be greater than 0", "error");
      return;
    }

    if (parseInt(formData.totalShares) <= 0) {
      showToast("Total shares must be greater than 0", "error");
      return;
    }

    if (parseFloat(formData.rent) <= 0) {
      showToast("Rent amount must be greater than 0", "error");
      return;
    }

    if (parseInt(formData.rentPeriod) <= 0) {
      showToast("Rent period must be greater than 0", "error");
      return;
    }

    setIsListing(true);
    try {
      let uploadedUrls: string[] = [];

      if (selectedFiles.length > 0) {
        showToast("Uploading images to IPFS...", "info");
        uploadedUrls = await Promise.all(selectedFiles.map((file) => uploadImageToPinata(file)));
      }

      const imagesPayload = uploadedUrls.length > 0
        ? uploadedUrls.join(",")
        : "https://via.placeholder.com/400x300?text=Property";

      const priceWei = ethers.parseEther(formData.price);
      const rentWei = ethers.parseEther(formData.rent);
      const totalShares = BigInt(formData.totalShares);
      const rentPeriod = BigInt(formData.rentPeriod);

      showToast(`Listing ${formData.name}...`, "info");

      const tx = await contract.listProperty(
        account, // owner
        formData.name,
        priceWei,
        totalShares,
        rentWei,
        rentPeriod,
        imagesPayload,
        formData.description || "No description provided",
        formData.propertyAddress || "Address not specified"
      );

      console.log("⏳ Transaction submitted:", tx.hash);
      showToast("Transaction submitted! Waiting for confirmation...", "info");
      
      await tx.wait();
      showToast("Transaction submitted! Waiting for confirmation...", "info");
      
      await tx.wait();

      showToast("Property listed successfully! You can now view it on the Home page.", "success");

      // Reset form
      setFormData({
        name: "",
        price: "",
        totalShares: "1000",
        rent: "",
        rentPeriod: "30",
        propertyAddress: "",
        description: "",
      });
      setSelectedFiles([]);
      setFileInputKey((prev) => prev + 1);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorLower = errorMessage.toLowerCase();
      
      if (errorLower.includes('user rejected') || errorLower.includes('user denied') || errorLower.includes('user cancelled')) {
        showToast("Transaction cancelled by user", "warning");
      } else if (errorLower.includes('insufficient funds') || errorLower.includes('insufficient balance')) {
        showToast("Insufficient funds to complete this transaction", "error");
      } else {
        const message = (error as { reason?: string; message?: string })?.reason 
          || (error as { message?: string })?.message 
          || "Failed to list property";
        showToast(`Failed to list property: ${message}`, "error");
      }
    } finally {
      setIsListing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[#4f4e55] text-white px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold text-white mb-4">
              List Your Property
            </h1>
            <p className="text-white/70 mb-8">
              Connect your wallet to list a property on the platform
            </p>
            <button
              onClick={connectWallet}
              className="bg-white hover:bg-gray-100 text-[#1E1E1E] px-8 py-3 rounded-lg font-semibold transition-colors text-lg"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </main>
    );
  }

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
            {/* Home Button */}
            <Link
              href="/"
              className="text-white hover:text-white/80 px-5 py-2 font-medium transition-colors"
            >
              <span>Home</span>
            </Link>

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
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-[#1E1E1E] border border-[#3A3A3A] rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#F9C80E] text-[#1E1E1E] rounded-lg flex items-center justify-center text-xl font-bold">
              i
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">
                How Property Listing Works
              </h3>
              <div className="text-sm text-white/90 space-y-2">
                <p>
                  <strong>1. Tokenization:</strong> Your property is divided into shares that investors can purchase.
                  Each share represents fractional ownership of the property.
                </p>
                <p>
                  <strong>2. Privacy:</strong> Share ownership is encrypted using FHEVM technology. Only you (the owner)
                  can view shareholder balances for management purposes.
                </p>
                <p>
                  <strong>3. Rent Distribution:</strong> You pay rent periodically, and shareholders can claim their
                  proportional share based on their encrypted holdings.
                </p>
                <p>
                  <strong>4. No Fees:</strong> There are no platform fees for listing properties. You receive 100% of
                  the funds from share sales (minus gas fees).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[#F5F5F5] rounded-lg shadow-lg p-8 border border-[#E0E0E0]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Property Name */}
            <div>
              <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                Property Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Luxury Downtown Apartment"
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
                required
              />
            </div>

            {/* Price & Shares */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                  Total Property Value (ETH) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  step="0.01"
                  min="0.01"
                  placeholder="e.g., 10.0"
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
                  required
                />
                <p className="text-xs text-[#2C2C2C]/70 mt-1">
                  Total value of the property in ETH
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                  Total Shares *
                </label>
                <input
                  type="number"
                  name="totalShares"
                  value={formData.totalShares}
                  onChange={handleChange}
                  min="1"
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
                  required
                />
                <p className="text-xs text-[#2C2C2C]/70 mt-1">
                  Number of shares to divide the property into
                </p>
              </div>
            </div>

            {/* Rent & Period */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                  Expected Rent per Period (ETH) *
                </label>
                <input
                  type="number"
                  name="rent"
                  value={formData.rent}
                  onChange={handleChange}
                  step="0.001"
                  min="0.001"
                  placeholder="e.g., 0.1"
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
                  required
                />
                <p className="text-xs text-[#2C2C2C]/70 mt-1">
                  Minimum rent amount you will pay per period
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                  Rent Period (days) *
                </label>
                <input
                  type="number"
                  name="rentPeriod"
                  value={formData.rentPeriod}
                  onChange={handleChange}
                  min="1"
                  placeholder="e.g., 30"
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
                  required
                />
                <p className="text-xs text-[#2C2C2C]/70 mt-1">
                  How often you will pay rent (in days)
                </p>
              </div>
            </div>

            {/* Property Address */}
            <div>
              <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                Property Address
              </label>
              <input
                type="text"
                name="propertyAddress"
                value={formData.propertyAddress}
                onChange={handleChange}
                placeholder="e.g., 123 Main Street, City, State 12345"
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe your property, amenities, location benefits, etc."
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#F9C80E] focus:border-transparent bg-white text-[#1E1E1E] placeholder:text-[#6B7280]"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-bold text-[#1E1E1E] mb-2">
                Upload Property Photos
              </label>
              <input
                key={fileInputKey}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="w-full border border-dashed border-[#E0E0E0] rounded-lg px-4 py-3 text-sm text-[#2C2C2C] cursor-pointer bg-white hover:border-[#F9C80E]"
              />
              <p className="text-xs text-[#2C2C2C]/70 mt-1">
                Images are uploaded to IPFS via Pinata before your listing is published.
              </p>
              {selectedFiles.length > 0 && (
                <ul className="mt-2 text-xs text-[#2C2C2C] space-y-1">
                  {selectedFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Calculation Summary */}
            {formData.price && formData.totalShares && (
              <div className="bg-[#FFF8E1] border border-[#F9C80E]/50 rounded-lg p-4">
                <h4 className="font-bold text-[#1E1E1E] mb-2">Calculated Share Price</h4>
                <p className="text-2xl font-bold text-[#F9C80E]">
                  {(parseFloat(formData.price) / parseInt(formData.totalShares || "1")).toFixed(6)} ETH per share
                </p>
                <p className="text-sm text-[#2C2C2C] mt-1">
                  Investors will pay this amount per share
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isListing}
                className="bg-[#F9C80E] hover:bg-[#e0b20d] disabled:bg-[#E0E0E0] disabled:cursor-not-allowed text-[#1E1E1E] px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                {isListing ? "Listing Property..." : "List Property"}
              </button>
              <Link
                href="/"
                className="px-8 py-4 bg-[#2C2C2C] hover:bg-[#3a3a3a] text-white rounded-lg font-bold text-lg transition-colors text-center border border-[#3A3A3A]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

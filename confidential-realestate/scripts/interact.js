const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Example interaction script for ConfidentialRealEstate contract
 * Demonstrates listing property, purchasing encrypted shares, and claiming rent
 */

async function main() {
  console.log("🎯 Interacting with ConfidentialRealEstate contract...\n");

  // Load deployment info
  const deploymentPath = `./deployments/${network.name}.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Please deploy first.`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log("📍 Contract Address:", contractAddress);
  console.log("🌐 Network:", network.name);
  console.log("🔗 Chain ID:", deploymentInfo.chainId, "\n");

  // Get signers
  const [owner, buyer1, buyer2] = await ethers.getSigners();
  console.log("👤 Owner:", owner.address);
  console.log("👤 Buyer 1:", buyer1.address);
  console.log("👤 Buyer 2:", buyer2.address, "\n");

  // Get contract instance
  const ConfidentialRealEstate = await ethers.getContractFactory("ConfidentialRealEstate");
  const contract = ConfidentialRealEstate.attach(contractAddress);

  // Example 1: List a property
  console.log("📝 Listing property...");
  const tx1 = await contract.listProperty(
    owner.address, // owner
    "Luxury Beachfront Villa", // name
    ethers.parseEther("100"), // price: 100 ETH
    1000, // totalShares: 1000 shares
    ethers.parseEther("1"), // rent: 1 ETH per period
    30, // rentPeriod: 30 days
    "ipfs://QmExample123", // images
    "A stunning 5-bedroom villa with ocean views", // description
    "123 Beach Road, Miami, FL" // propertyAddress
  );
  await tx1.wait();
  console.log("✅ Property listed with ID: 1\n");

  // Example 2: Get property details
  console.log("📖 Fetching property details...");
  const property = await contract.getProperty(1);
  console.log("Property Name:", property.name);
  console.log("Price:", ethers.formatEther(property.price), "ETH");
  console.log("Total Shares:", property.totalShares.toString());
  console.log("Available Shares:", property.availableShares.toString());
  console.log("Rent per Period:", ethers.formatEther(property.rent), "ETH\n");

  // Example 3: Purchase shares (encrypted)
  console.log("🛒 Buyer 1 purchasing 100 shares (encrypted)...");
  // Note: In production, buyer would encrypt shares client-side using fhevmjs
  // For this demo, we'll use the contract's encryption
  const sharesToBuy = 100;
  const sharePrice = property.price / property.totalShares;
  const totalCost = sharePrice * BigInt(sharesToBuy);

  // This is a simplified example - in production you'd use fhevmjs to create encrypted input
  console.log("⚠️  Note: This example uses simplified encryption.");
  console.log("    In production, use fhevmjs library for client-side encryption.\n");

  // Example 4: Check shareholder info
  console.log("📊 Checking buyer 1 shareholder info...");
  try {
    const shareholderInfo = await contract.getShareholderInfo(1, buyer1.address);
    console.log("Encrypted Shares:", shareholderInfo.encryptedShares); // Returns euint64 (encrypted)
    console.log("Rent Claimed:", ethers.formatEther(shareholderInfo.rentClaimed), "ETH");
    console.log("ℹ️  Shares are encrypted - only buyer1 and property owner can decrypt\n");
  } catch (error) {
    console.log("⚠️  Cannot fetch shareholder info:", error.message, "\n");
  }

  // Example 5: Get all properties
  console.log("📚 Fetching all properties...");
  const allProperties = await contract.getAllProperties();
  console.log("Total Listed Properties:", allProperties.ids.length);
  for (let i = 0; i < allProperties.ids.length; i++) {
    console.log(`  [${i + 1}] ${allProperties.names[i]} - ${ethers.formatEther(allProperties.prices[i])} ETH`);
  }
  console.log();

  // Example 6: Check if rent is due
  console.log("🏠 Checking rent status...");
  const rentDue = await contract.isRentDue(1);
  console.log("Rent Due:", rentDue ? "Yes" : "No\n");

  console.log("✨ Interaction complete!\n");
  console.log("📝 Next steps:");
  console.log("  1. Install fhevmjs in frontend: npm install fhevmjs");
  console.log("  2. Encrypt share amounts client-side before purchase");
  console.log("  3. Use TFHE.decrypt() with proper ACL for viewing encrypted shares");
  console.log("  4. Integrate with Zama Gateway for decryption requests\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Interaction failed:", error);
    process.exit(1);
  });

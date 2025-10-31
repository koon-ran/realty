const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x8964356F5eFe02d966650BE7A5514451Db09E688";
  
  console.log("\n🔍 Verifying Contract Functions...\n");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🌐 Network:", network.name);
  
  const [owner] = await ethers.getSigners();
  console.log("👤 Owner:", owner.address);
  
  const artifact = require("../artifacts/contracts/ConfidentialRealEstate.sol/ConfidentialRealEstate.json");
  const contract = new ethers.Contract(contractAddress, artifact.abi, owner);
  
  console.log("\n📋 Checking Available Functions:");
  console.log("================================");
  
  // Check core functions
  const coreFunctions = [
    'listProperty',
    'purchaseShares', 
    'payRent',
    'claimRent',
    'getProperty',
    'getAllProperties',
    'getShareholderInfo'
  ];
  
  // Check new management functions
  const managementFunctions = [
    'updateProperty',
    'updateRentAmount',
    'pauseProperty',
    'unpauseProperty'
  ];
  
  console.log("\n✅ Core Functions:");
  for (const funcName of coreFunctions) {
    const exists = typeof contract[funcName] === 'function';
    console.log(`   ${exists ? '✓' : '✗'} ${funcName}`);
  }
  
  console.log("\n✅ Management Functions:");
  for (const funcName of managementFunctions) {
    const exists = typeof contract[funcName] === 'function';
    console.log(`   ${exists ? '✓' : '✗'} ${funcName}`);
  }
  
  // Get property 1 details
  console.log("\n🏠 Property #1 Details:");
  console.log("=======================");
  try {
    const property = await contract.getProperty(1);
    console.log("   Name:", property.name);
    console.log("   Owner:", property.owner);
    console.log("   Price:", ethers.formatEther(property.price), "ETH");
    console.log("   Rent:", ethers.formatEther(property.rent), "ETH");
    console.log("   Listed:", property.isListed);
    console.log("   Available Shares:", property.availableShares.toString());
    console.log("   Description:", property.description);
  } catch (error) {
    console.error("   ❌ Failed to get property:", error.message);
  }
  
  console.log("\n✨ Verification complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

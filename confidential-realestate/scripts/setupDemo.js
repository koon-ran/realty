const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x8964356F5eFe02d966650BE7A5514451Db09E688";
  
  console.log("\n🎯 Setting up demo property on Sepolia...\n");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🌐 Network:", network.name);
  
  const [owner] = await ethers.getSigners();
  console.log("👤 Owner:", owner.address);
  
  const artifact = require("../artifacts/contracts/ConfidentialRealEstate.sol/ConfidentialRealEstate.json");
  const contract = new ethers.Contract(contractAddress, artifact.abi, owner);
  
  // List a property
  console.log("\n📝 Listing property...");
  const price = ethers.parseEther("1"); // 1 ETH total property value
  const totalShares = 1000n;
  const rent = ethers.parseEther("0.01"); // 0.01 ETH rent per period
  const rentPeriod = 30n; // 30 days (contract will convert to seconds)
  
  const tx = await contract.listProperty(
    owner.address, // _owner
    "Cozy Downtown Apartment", // _name
    price, // _price
    totalShares, // _totalShares
    rent, // _rent
    rentPeriod, // _rentPeriod
    "https://example.com/apartment.jpg", // _images
    "A modern apartment in the city center, perfect for testing!", // _description
    "456 Main Street, Downtown" // _propertyAddress
  );
  
  console.log("⏳ Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Property listed successfully!");
  
  // Get property details
  const property = await contract.getProperty(1);
  console.log("\n🏠 Property Details:");
  console.log("   ID:", property.id.toString());
  console.log("   Name:", property.name);
  console.log("   Price:", ethers.formatEther(property.price), "ETH");
  console.log("   Total shares:", property.totalShares.toString());
  console.log("   Available shares:", property.availableShares.toString());
  console.log("   Owner:", property.owner);
  console.log("   Description:", property.description);
  console.log("   Address:", property.propertyAddress);
  
  console.log("\n✨ Demo property created! You can now test it in the frontend.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

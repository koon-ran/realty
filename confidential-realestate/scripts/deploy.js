const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ConfidentialRealEstate contract with FHEVM...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // Check if balance is sufficient
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance! Deployment may fail.");
  }
  console.log();

  // Get contract factory
  const ConfidentialRealEstate = await ethers.getContractFactory("ConfidentialRealEstate");

  // Deploy contract
  console.log("⏳ Deploying ConfidentialRealEstate contract...");
  console.log("   This may take a moment due to FHEVM compilation...");
  
  const contract = await ConfidentialRealEstate.deploy();
  console.log("   Transaction hash:", contract.deploymentTransaction().hash);
  
  console.log("⏳ Waiting for confirmations...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ ConfidentialRealEstate deployed successfully!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("� Contract Owner:", await contract.contractOwner());

  // Log deployment info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  
  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log("Contract Address:", contractAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name || "unknown");
  console.log("Chain ID:", network.chainId.toString());
  console.log("Block Number:", blockNumber);
  console.log("Gas Used:", contract.deploymentTransaction().gasLimit?.toString() || "N/A");
  console.log("========================\n");

  // FHEVM-specific info
  console.log(" FHEVM Features:");
  console.log("   ✓ Encrypted share balances (euint64)");
  console.log("   ✓ ACL for shareholder privacy");
  console.log("   ✓ Property owner can view all holdings");
  console.log("   ✓ Gateway integration ready");
  console.log();

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name || "unknown",
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: blockNumber,
    transactionHash: contract.deploymentTransaction().hash,
    features: {
      encryptedShares: true,
      aclEnabled: true,
      rentSystem: true,
    }
  };

  const networkName = (await ethers.provider.getNetwork()).name || "unknown";
  const deploymentPath = `./deployments/${networkName}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);

  // Create a deployments index file
  const deploymentsIndex = "./deployments/latest.json";
  fs.writeFileSync(deploymentsIndex, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Latest deployment saved to:", deploymentsIndex);

  // Verification instructions
  if (networkName === "sepolia") {
    console.log("\n🔍 To verify on Etherscan:");
    console.log(`npx hardhat verify --network sepolia ${contractAddress}`);
  }

  // Frontend integration instructions
  console.log("\n📱 Frontend Integration:");
  console.log("   1. Copy contract address:", contractAddress);
  console.log("   2. Import ABI from artifacts/contracts/ConfidentialRealEstate.sol/ConfidentialRealEstate.json");
  console.log("   3. Use fhevmjs for client-side encryption");
  console.log("   4. Connect with Gateway for decryption");

  console.log("\n✨ Deployment complete!\n");
  
  return contractAddress;
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

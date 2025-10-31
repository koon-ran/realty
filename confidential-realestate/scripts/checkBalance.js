const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  
  console.log("\n💰 Account Balance Check");
  console.log("========================");
  console.log("Address:", signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("Network:", network.name);
  console.log("========================\n");
  
  if (balance === 0n) {
    console.log("⚠️  Zero balance! Get test ETH from:");
    console.log("   • https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("   • https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

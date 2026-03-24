const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`\n🚀 Deploying MediProof to: ${network.name}`);

  const [deployer] = await ethers.getSigners();
  console.log(`📬 Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance : ${ethers.formatEther(balance)} MONAD\n`);

  const MediProof = await ethers.getContractFactory("MediProof");
  const contract = await MediProof.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash || "n/a";

  console.log(`✅ MediProof deployed at  : ${address}`);
  console.log(`🔗 Deploy tx hash         : ${txHash}`);

  const threshold = await contract.SUSPICIOUS_THRESHOLD();
  console.log(`🛡  SUSPICIOUS_THRESHOLD   : ${threshold}`);

  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    address,
    txHash,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${outFile}`);

  console.log("\n──────────────────────────────────────────");
  console.log("Copy to your .env file:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
  console.log("──────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
  });

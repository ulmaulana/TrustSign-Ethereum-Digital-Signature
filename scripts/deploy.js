const hre = require("hardhat");

async function main() {
  console.log("Deploying DigitalSignature contract...");
  
  const DigitalSignature = await hre.ethers.getContractFactory("DigitalSignature");
  const digitalSignature = await DigitalSignature.deploy();

  console.log("Waiting for deployment confirmation...");
  await digitalSignature.waitForDeployment();

  const address = await digitalSignature.getAddress();
  console.log("DigitalSignature deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
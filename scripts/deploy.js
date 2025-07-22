const hre = require("hardhat");

async function main() {
  console.log("Deploying Decentralized Voting System...");

  // Deploy the voting contract
  const DecentralizedVotingSystem = await hre.ethers.getContractFactory("DecentralizedVotingSystem");
  const votingSystem = await DecentralizedVotingSystem.deploy();
  await votingSystem.waitForDeployment();

  const address = await votingSystem.getAddress();
  console.log("DecentralizedVotingSystem deployed to:", address);

  // Create a sample election
  const [owner] = await hre.ethers.getSigners();
  
  const candidates = [
    "Alice Johnson",
    "Bob Smith", 
    "Carol Davis",
    "David Wilson"
  ];

  const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
  const endTime = startTime + (7 * 24 * 60 * 60); // End in 7 days

  const tx = await votingSystem.createElection(
    "Presidential Election 2024",
    "National presidential election with blockchain verification",
    startTime,
    endTime,
    candidates
  );

  await tx.wait();
  console.log("Sample election created successfully!");

  console.log("\nDeployment completed!");
  console.log("Contract address:", address);
  console.log("Owner address:", await owner.getAddress());
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: address,
    ownerAddress: await owner.getAddress(),
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    'deployment.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
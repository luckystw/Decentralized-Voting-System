const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DecentralizedVotingSystem", function () {
  let votingSystem;
  let owner;
  let voter1;
  let voter2;
  let voter3;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
    
    const DecentralizedVotingSystem = await ethers.getContractFactory("DecentralizedVotingSystem");
    votingSystem = await DecentralizedVotingSystem.deploy();
    await votingSystem.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await votingSystem.owner()).to.equal(owner.address);
    });

    it("Should start with zero elections", async function () {
      expect(await votingSystem.getElectionCount()).to.equal(0);
    });
  });

  describe("Voter Registration", function () {
    it("Should register a voter successfully", async function () {
      const publicKey = "0x1234567890abcdef";
      
      await votingSystem.connect(voter1).registerVoter(publicKey);
      
      const voter = await votingSystem.getVoter(voter1.address);
      expect(voter.isRegistered).to.be.true;
      expect(voter.publicKey).to.equal(publicKey);
    });

    it("Should not allow duplicate registration", async function () {
      const publicKey = "0x1234567890abcdef";
      
      await votingSystem.connect(voter1).registerVoter(publicKey);
      
      await expect(
        votingSystem.connect(voter1).registerVoter(publicKey)
      ).to.be.revertedWith("Voter already registered");
    });

    it("Should not allow empty public key", async function () {
      await expect(
        votingSystem.connect(voter1).registerVoter("")
      ).to.be.revertedWith("Public key cannot be empty");
    });
  });

  describe("Election Creation", function () {
    it("Should create an election successfully", async function () {
      const name = "Test Election";
      const description = "A test election";
      const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
      const endTime = startTime + 3600; // End in 1 hour
      const candidates = ["Alice", "Bob", "Carol"];

      await votingSystem.createElection(name, description, startTime, endTime, candidates);

      const election = await votingSystem.getElection(0);
      expect(election.name).to.equal(name);
      expect(election.description).to.equal(description);
      expect(election.startTime).to.equal(startTime);
      expect(election.endTime).to.equal(endTime);
      expect(election.isActive).to.be.true;
      expect(election.candidateCount).to.equal(3);
    });

    it("Should not allow non-owner to create election", async function () {
      const name = "Test Election";
      const description = "A test election";
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob"];

      await expect(
        votingSystem.connect(voter1).createElection(name, description, startTime, endTime, candidates)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should require at least 2 candidates", async function () {
      const name = "Test Election";
      const description = "A test election";
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice"];

      await expect(
        votingSystem.createElection(name, description, startTime, endTime, candidates)
      ).to.be.revertedWith("At least 2 candidates required");
    });

    it("Should not allow past start time", async function () {
      const name = "Test Election";
      const description = "A test election";
      const startTime = Math.floor(Date.now() / 1000) - 60; // Past time
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob"];

      await expect(
        votingSystem.createElection(name, description, startTime, endTime, candidates)
      ).to.be.revertedWith("Start time must be in the future");
    });
  });

  describe("Vote Casting", function () {
    beforeEach(async function () {
      // Register voters
      await votingSystem.connect(voter1).registerVoter("0x1234567890abcdef");
      await votingSystem.connect(voter2).registerVoter("0xfedcba0987654321");
      
      // Create election
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob", "Carol"];
      
      await votingSystem.createElection(
        "Test Election",
        "A test election",
        startTime,
        endTime,
        candidates
      );
    });

    it("Should cast a vote successfully", async function () {
      const electionId = 0;
      const candidateId = 1;
      const secret = "mysecret123";
      
      // Create commitment
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes(candidateId.toString() + secret));
      const commitment = ethers.keccak256(ethers.toUtf8Bytes(voteHash + secret));

      await votingSystem.connect(voter1).castVote(electionId, commitment);

      const voter = await votingSystem.getVoter(voter1.address);
      expect(voter.hasVoted).to.be.true;
    });

    it("Should not allow unregistered voter to vote", async function () {
      const electionId = 0;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(
        votingSystem.connect(voter3).castVote(electionId, commitment)
      ).to.be.revertedWith("Voter not registered");
    });

    it("Should not allow double voting", async function () {
      const electionId = 0;
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("test1"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));

      await votingSystem.connect(voter1).castVote(electionId, commitment1);

      await expect(
        votingSystem.connect(voter1).castVote(electionId, commitment2)
      ).to.be.revertedWith("Voter has already voted");
    });

    it("Should not allow duplicate commitments", async function () {
      const electionId = 0;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await votingSystem.connect(voter1).castVote(electionId, commitment);

      await expect(
        votingSystem.connect(voter2).castVote(electionId, commitment)
      ).to.be.revertedWith("Commitment already used");
    });
  });

  describe("Vote Revealing", function () {
    beforeEach(async function () {
      // Register voters
      await votingSystem.connect(voter1).registerVoter("0x1234567890abcdef");
      
      // Create election
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob", "Carol"];
      
      await votingSystem.createElection(
        "Test Election",
        "A test election",
        startTime,
        endTime,
        candidates
      );

      // Cast vote
      const electionId = 0;
      const candidateId = 1;
      const secret = "mysecret123";
      
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes(candidateId.toString() + secret));
      const commitment = ethers.keccak256(ethers.toUtf8Bytes(voteHash + secret));

      await votingSystem.connect(voter1).castVote(electionId, commitment);
    });

    it("Should reveal vote successfully after election ends", async function () {
      // Fast forward time to after election ends
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      const voteId = 0;
      const candidateId = 1;
      const secret = "mysecret123";

      await votingSystem.revealVote(voteId, candidateId, secret);

      const candidate = await votingSystem.getCandidate(0, candidateId);
      expect(candidate.voteCount).to.equal(1);
    });

    it("Should not allow revealing before election ends", async function () {
      const voteId = 0;
      const candidateId = 1;
      const secret = "mysecret123";

      await expect(
        votingSystem.revealVote(voteId, candidateId, secret)
      ).to.be.revertedWith("Election is still active");
    });

    it("Should not allow revealing with invalid commitment", async function () {
      // Fast forward time to after election ends
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      const voteId = 0;
      const candidateId = 1;
      const wrongSecret = "wrongsecret";

      await expect(
        votingSystem.revealVote(voteId, candidateId, wrongSecret)
      ).to.be.revertedWith("Invalid commitment");
    });
  });

  describe("Election Management", function () {
    it("Should end election successfully", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob"];
      
      await votingSystem.createElection(
        "Test Election",
        "A test election",
        startTime,
        endTime,
        candidates
      );

      await votingSystem.endElection(0);

      const election = await votingSystem.getElection(0);
      expect(election.isActive).to.be.false;
    });

    it("Should not allow non-owner to end election", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;
      const candidates = ["Alice", "Bob"];
      
      await votingSystem.createElection(
        "Test Election",
        "A test election",
        startTime,
        endTime,
        candidates
      );

      await expect(
        votingSystem.connect(voter1).endElection(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 
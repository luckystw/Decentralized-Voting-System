// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title DecentralizedVotingSystem
 * @dev A secure blockchain-based voting system with cryptographic verification
 */
contract DecentralizedVotingSystem is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Structs
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        bytes32 voteHash;
        uint256 registrationTime;
        string publicKey;
    }

    struct Election {
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        uint256 totalVotes;
        mapping(address => bool) hasVoted;
        mapping(uint256 => string) candidates;
        mapping(uint256 => uint256) voteCounts;
        uint256 candidateCount;
    }

    struct Vote {
        bytes32 voteHash;
        bytes32 commitment;
        uint256 timestamp;
        bool isRevealed;
    }

    // State variables
    Counters.Counter private _electionIds;
    Counters.Counter private _voteIds;
    
    mapping(uint256 => Election) public elections;
    mapping(address => Voter) public voters;
    mapping(uint256 => Vote) public votes;
    mapping(bytes32 => bool) public usedCommitments;
    
    // Events
    event VoterRegistered(address indexed voter, string publicKey, uint256 timestamp);
    event ElectionCreated(uint256 indexed electionId, string name, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed voteId, address indexed voter, bytes32 commitment, uint256 timestamp);
    event VoteRevealed(uint256 indexed voteId, uint256 candidateId, bytes32 voteHash);
    event ElectionEnded(uint256 indexed electionId, uint256 totalVotes);

    // Modifiers
    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "Voter not registered");
        _;
    }

    modifier electionExists(uint256 electionId) {
        require(electionId < _electionIds.current(), "Election does not exist");
        _;
    }

    modifier electionActive(uint256 electionId) {
        require(elections[electionId].isActive, "Election is not active");
        require(block.timestamp >= elections[electionId].startTime, "Election has not started");
        require(block.timestamp <= elections[electionId].endTime, "Election has ended");
        _;
    }

    modifier electionEnded(uint256 electionId) {
        require(block.timestamp > elections[electionId].endTime, "Election is still active");
        _;
    }

    /**
     * @dev Register a new voter with their public key
     * @param publicKey The voter's public key for cryptographic operations
     */
    function registerVoter(string memory publicKey) external {
        require(!voters[msg.sender].isRegistered, "Voter already registered");
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        
        voters[msg.sender] = Voter({
            isRegistered: true,
            hasVoted: false,
            voteHash: bytes32(0),
            registrationTime: block.timestamp,
            publicKey: publicKey
        });
        
        emit VoterRegistered(msg.sender, publicKey, block.timestamp);
    }

    /**
     * @dev Create a new election (only owner)
     * @param name Election name
     * @param description Election description
     * @param startTime Election start timestamp
     * @param endTime Election end timestamp
     * @param candidates Array of candidate names
     */
    function createElection(
        string memory name,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        string[] memory candidates
    ) external onlyOwner {
        require(startTime > block.timestamp, "Start time must be in the future");
        require(endTime > startTime, "End time must be after start time");
        require(candidates.length >= 2, "At least 2 candidates required");
        
        uint256 electionId = _electionIds.current();
        Election storage election = elections[electionId];
        
        election.name = name;
        election.description = description;
        election.startTime = startTime;
        election.endTime = endTime;
        election.isActive = true;
        election.totalVotes = 0;
        election.candidateCount = candidates.length;
        
        for (uint256 i = 0; i < candidates.length; i++) {
            election.candidates[i] = candidates[i];
            election.voteCounts[i] = 0;
        }
        
        _electionIds.increment();
        
        emit ElectionCreated(electionId, name, startTime, endTime);
    }

    /**
     * @dev Cast a vote using commitment scheme for privacy
     * @param electionId The election ID
     * @param commitment The commitment hash (hash of vote + secret)
     */
    function castVote(uint256 electionId, bytes32 commitment) 
        external 
        onlyRegisteredVoter 
        electionExists(electionId) 
        electionActive(electionId) 
        nonReentrant 
    {
        require(!voters[msg.sender].hasVoted, "Voter has already voted");
        require(!usedCommitments[commitment], "Commitment already used");
        
        uint256 voteId = _voteIds.current();
        
        votes[voteId] = Vote({
            voteHash: bytes32(0),
            commitment: commitment,
            timestamp: block.timestamp,
            isRevealed: false
        });
        
        voters[msg.sender].hasVoted = true;
        elections[electionId].hasVoted[msg.sender] = true;
        elections[electionId].totalVotes++;
        usedCommitments[commitment] = true;
        
        _voteIds.increment();
        
        emit VoteCast(voteId, msg.sender, commitment, block.timestamp);
    }

    /**
     * @dev Reveal a vote after election ends
     * @param voteId The vote ID
     * @param candidateId The candidate ID that was voted for
     * @param secret The secret used in commitment
     */
    function revealVote(uint256 voteId, uint256 candidateId, bytes32 secret) 
        external 
        electionEnded(voteId) 
    {
        Vote storage vote = votes[voteId];
        require(!vote.isRevealed, "Vote already revealed");
        require(candidateId < elections[voteId].candidateCount, "Invalid candidate");
        
        // Verify the commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(candidateId, secret));
        require(vote.commitment == expectedCommitment, "Invalid commitment");
        
        vote.voteHash = keccak256(abi.encodePacked(candidateId, secret, vote.timestamp));
        vote.isRevealed = true;
        
        elections[voteId].voteCounts[candidateId]++;
        
        emit VoteRevealed(voteId, candidateId, vote.voteHash);
    }

    /**
     * @dev Get election details
     * @param electionId The election ID
     */
    function getElection(uint256 electionId) 
        external 
        view 
        electionExists(electionId) 
        returns (
            string memory name,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            uint256 totalVotes,
            uint256 candidateCount
        ) 
    {
        Election storage election = elections[electionId];
        return (
            election.name,
            election.description,
            election.startTime,
            election.endTime,
            election.isActive,
            election.totalVotes,
            election.candidateCount
        );
    }

    /**
     * @dev Get candidate information
     * @param electionId The election ID
     * @param candidateId The candidate ID
     */
    function getCandidate(uint256 electionId, uint256 candidateId) 
        external 
        view 
        electionExists(electionId) 
        returns (string memory name, uint256 voteCount) 
    {
        require(candidateId < elections[electionId].candidateCount, "Invalid candidate");
        Election storage election = elections[electionId];
        return (election.candidates[candidateId], election.voteCounts[candidateId]);
    }

    /**
     * @dev Get voter information
     * @param voterAddress The voter's address
     */
    function getVoter(address voterAddress) 
        external 
        view 
        returns (
            bool isRegistered,
            bool hasVoted,
            uint256 registrationTime,
            string memory publicKey
        ) 
    {
        Voter storage voter = voters[voterAddress];
        return (
            voter.isRegistered,
            voter.hasVoted,
            voter.registrationTime,
            voter.publicKey
        );
    }

    /**
     * @dev Get total number of elections
     */
    function getElectionCount() external view returns (uint256) {
        return _electionIds.current();
    }

    /**
     * @dev Get total number of votes
     */
    function getVoteCount() external view returns (uint256) {
        return _voteIds.current();
    }

    /**
     * @dev End an election (only owner)
     * @param electionId The election ID
     */
    function endElection(uint256 electionId) 
        external 
        onlyOwner 
        electionExists(electionId) 
    {
        elections[electionId].isActive = false;
        emit ElectionEnded(electionId, elections[electionId].totalVotes);
    }
} 
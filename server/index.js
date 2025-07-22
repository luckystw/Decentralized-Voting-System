const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { ethers } = require('ethers');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import our modules
const db = require('./database');
const auth = require('./auth');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Session configuration
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './'
  }),
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Initialize passport
app.use(auth.passport.initialize());
app.use(auth.passport.session());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Web3 provider
let provider;
let votingContract;
let contractAddress;

// Initialize blockchain connection
async function initializeBlockchain() {
  try {
    const networkUrl = process.env.BLOCKCHAIN_URL || 'http://localhost:8545';
    provider = new ethers.JsonRpcProvider(networkUrl);
    
    const contractABI = require('../artifacts/contracts/VotingSystem.sol/DecentralizedVotingSystem.json').abi;
    contractAddress = process.env.CONTRACT_ADDRESS;
    
    if (contractAddress) {
      votingContract = new ethers.Contract(contractAddress, contractABI, provider);
      console.log('✅ Connected to voting contract at:', contractAddress);
    } else {
      console.log('⚠️  Contract address not set. Please deploy the contract first.');
    }
  } catch (error) {
    console.error('❌ Failed to initialize blockchain connection:', error.message);
  }
}

// Utility functions
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

function hashVote(candidateId, secret) {
  return crypto.createHash('sha256')
    .update(candidateId.toString() + secret)
    .digest('hex');
}

function generateCommitment(voteHash, secret) {
  return crypto.createHash('sha256')
    .update(voteHash + secret)
    .digest('hex');
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    blockchain: provider ? 'Connected' : 'Disconnected',
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// Authentication Routes

// Traditional registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, walletAddress } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Register user
    const user = await auth.registerUser({ username, email, password, walletAddress });

    // Generate token and session
    const token = auth.generateToken(user);
    await auth.createSession(user, token);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Traditional login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await auth.authenticateEmailPassword(email, password);
    const token = auth.generateToken(user);
    await auth.createSession(user, token);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Google OAuth routes (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/api/auth/google',
    auth.passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    auth.passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
      try {
        const token = auth.generateToken(req.user);
        await auth.createSession(req.user, token);
        
        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth-callback?token=${token}`);
      } catch (error) {
        console.error('Google auth error:', error);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
      }
    }
  );
} else {
  console.log('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.');
}

// MetaMask authentication
app.post('/api/auth/metamask', async (req, res) => {
  try {
    const { signature, message, address } = req.body;

    if (!signature || !message || !address) {
      return res.status(400).json({ error: 'Signature, message, and address are required' });
    }

    const user = await auth.authenticateMetaMask(signature, message, address);
    const token = auth.generateToken(user);
    await auth.createSession(user, token);

    res.json({
      message: 'MetaMask authentication successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('MetaMask auth error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Link wallet to existing account
app.post('/api/auth/link-wallet', auth.authenticateToken, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Wallet address, signature, and message are required' });
    }

    const user = await auth.linkWalletToAccount(req.user.id, walletAddress, signature, message);

    res.json({
      message: 'Wallet linked successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Link wallet error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', auth.authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await db.deleteSession(token);
    }
    
    req.logout();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user profile
app.get('/api/user/profile', auth.authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get voting stats
    const stats = await db.getUserStats(user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.wallet_address,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      },
      stats: {
        totalVotes: stats.total_votes || 0,
        lastVote: stats.last_vote
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/user/profile', auth.authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = {};
    
    if (username) updates.username = username;
    if (email) updates.email = email;

    await db.updateUser(req.user.id, updates);
    const updatedUser = await db.getUserById(req.user.id);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        walletAddress: updatedUser.wallet_address,
        avatarUrl: updatedUser.avatar_url
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get voting history
app.get('/api/user/voting-history', auth.authenticateToken, async (req, res) => {
  try {
    const history = await db.getUserVotingHistory(req.user.id);
    res.json({ votes: history });
  } catch (error) {
    console.error('Get voting history error:', error);
    res.status(500).json({ error: 'Failed to fetch voting history' });
  }
});

// Get elections
app.get('/api/elections', auth.authenticateToken, async (req, res) => {
  try {
    if (!votingContract) {
      return res.status(503).json({ error: 'Blockchain not connected' });
    }

    const electionCount = await votingContract.getElectionCount();
    const elections = [];

    for (let i = 0; i < electionCount; i++) {
      const election = await votingContract.getElection(i);
      elections.push({
        id: i,
        title: election.name,
        description: election.description,
        startDate: new Date(parseInt(election.startTime) * 1000).toISOString(),
        endDate: new Date(parseInt(election.endTime) * 1000).toISOString(),
        isActive: election.isActive,
        totalVotes: election.totalVotes.toString(),
        candidateCount: election.candidateCount.toString()
      });
    }

    res.json({ elections });

  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ error: 'Failed to fetch elections' });
  }
});

// Get election details
app.get('/api/elections/:id', auth.authenticateToken, async (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    
    if (!votingContract) {
      return res.status(503).json({ error: 'Blockchain not connected' });
    }

    const election = await votingContract.getElection(electionId);
    const candidates = [];

    for (let i = 0; i < election.candidateCount; i++) {
      const candidate = await votingContract.getCandidate(electionId, i);
      candidates.push({
        id: i,
        name: candidate.name,
        description: candidate.description || '',
        votes: candidate.voteCount.toString()
      });
    }

    res.json({
      id: electionId,
      title: election.name,
      description: election.description,
      startDate: new Date(parseInt(election.startTime) * 1000).toISOString(),
      endDate: new Date(parseInt(election.endTime) * 1000).toISOString(),
      isActive: election.isActive,
      totalVotes: election.totalVotes.toString(),
      candidates
    });

  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ error: 'Failed to fetch election details' });
  }
});

// Cast vote
app.post('/api/elections/:id/vote', auth.authenticateToken, async (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    const { candidateId } = req.body;

    if (!votingContract) {
      return res.status(503).json({ error: 'Blockchain not connected' });
    }

    // Generate secret and vote hash
    const secret = crypto.randomBytes(32).toString('hex');
    const voteHash = hashVote(candidateId, secret);
    const commitment = generateCommitment(voteHash, secret);

    // Cast vote on blockchain
    const signer = provider.getSigner();
    const contractWithSigner = votingContract.connect(signer);
    await contractWithSigner.castVote(electionId, commitment);

    // Store voting record
    await db.addVotingRecord({
      id: uuidv4(),
      userId: req.user.id,
      electionId,
      candidateId,
      voteHash,
      commitment
    });

    res.json({ 
      message: 'Vote cast successfully',
      commitment,
      voteHash
    });

  } catch (error) {
    console.error('Cast vote error:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// Get stats
app.get('/api/stats', auth.authenticateToken, async (req, res) => {
  try {
    // Get total elections
    let totalElections = 0;
    let activeElections = 0;
    let totalVotes = 0;

    if (votingContract) {
      totalElections = await votingContract.getElectionCount();
      
      for (let i = 0; i < totalElections; i++) {
        const election = await votingContract.getElection(i);
        if (election.isActive) {
          activeElections++;
        }
        totalVotes += parseInt(election.totalVotes);
      }
    }

    // Get user stats
    const userStats = await db.getUserStats(req.user.id);

    res.json({
      totalElections,
      activeElections,
      totalVotes,
      userVotes: userStats.total_votes || 0
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Initialize database
  await db.init();
  console.log('✅ Database initialized');
  
  // Start cleanup process
  db.startCleanup();
  console.log('✅ Session cleanup started');
  
  // Initialize blockchain
  await initializeBlockchain();
});

module.exports = app; 
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await db.getUserById(payload.userId);
    if (!user) {
      return done(null, false);
    }
    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));

// Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await db.getUserByGoogleId(profile.id);
      
      if (!user) {
        // Create new user
        const userData = {
          id: uuidv4(),
          username: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          avatarUrl: profile.photos[0]?.value,
          createdAt: new Date().toISOString()
        };
        
        await db.createUser(userData);
        user = await db.getUserByGoogleId(profile.id);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      walletAddress: user.wallet_address 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Create session
const createSession = async (user, token) => {
  const sessionData = {
    id: uuidv4(),
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };
  
  await db.createSession(sessionData);
  return sessionData;
};

// MetaMask authentication
const authenticateMetaMask = async (signature, message, address) => {
  try {
    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Invalid signature');
    }
    
    // Check if user exists with this wallet address
    let user = await db.getUserByWalletAddress(address);
    
    if (!user) {
      // Create new user with wallet address
      const userData = {
        id: uuidv4(),
        username: `User_${address.slice(0, 8)}`,
        email: `${address.slice(0, 8)}@wallet.local`,
        walletAddress: address,
        createdAt: new Date().toISOString()
      };
      
      await db.createUser(userData);
      user = await db.getUserByWalletAddress(address);
    }
    
    return user;
  } catch (error) {
    throw new Error('MetaMask authentication failed');
  }
};

// Traditional email/password authentication
const authenticateEmailPassword = async (email, password) => {
  const user = await db.getUserByEmail(email);
  if (!user || !user.password) {
    throw new Error('Invalid credentials');
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }
  
  return user;
};

// Register new user
const registerUser = async (userData) => {
  const { username, email, password, walletAddress } = userData;
  
  // Check if user already exists
  const existingUser = await db.getUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists');
  }
  
  // Validate wallet address if provided
  if (walletAddress && !ethers.isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // Create user
  const newUserData = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    walletAddress,
    createdAt: new Date().toISOString()
  };
  
  await db.createUser(newUserData);
  return await db.getUserByEmail(email);
};

// Link wallet to existing account
const linkWalletToAccount = async (userId, walletAddress, signature, message) => {
  try {
    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Invalid signature');
    }
    
    // Check if wallet is already linked to another account
    const existingWalletUser = await db.getUserByWalletAddress(walletAddress);
    if (existingWalletUser && existingWalletUser.id !== userId) {
      throw new Error('Wallet already linked to another account');
    }
    
    // Update user with wallet address
    await db.updateUser(userId, { wallet_address: walletAddress });
    
    return await db.getUserById(userId);
  } catch (error) {
    throw new Error('Failed to link wallet');
  }
};

module.exports = {
  passport,
  authenticateToken,
  generateToken,
  createSession,
  authenticateMetaMask,
  authenticateEmailPassword,
  registerUser,
  linkWalletToAccount
}; 
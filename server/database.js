const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'voting_system.db'));
    this.init();
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            wallet_address TEXT UNIQUE,
            public_key TEXT,
            private_key TEXT,
            google_id TEXT UNIQUE,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Sessions table for persistent login
        this.db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        // Voting history table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS voting_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            election_id INTEGER NOT NULL,
            candidate_id INTEGER NOT NULL,
            vote_hash TEXT NOT NULL,
            commitment TEXT NOT NULL,
            voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        // Create indexes
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_voting_history_user ON voting_history(user_id)');

        resolve();
      });
    });
  }

  // User methods
  async createUser(userData) {
    return new Promise((resolve, reject) => {
      const { id, username, email, password, walletAddress, publicKey, privateKey, googleId, avatarUrl } = userData;
      
      this.db.run(`
        INSERT INTO users (id, username, email, password, wallet_address, public_key, private_key, google_id, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, username, email, password, walletAddress, publicKey, privateKey, googleId, avatarUrl], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getUserByWalletAddress(walletAddress) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getUserByGoogleId(googleId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updateUser(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(new Date().toISOString()); // updated_at
      values.push(id);

      this.db.run(`
        UPDATE users SET ${fields}, updated_at = ? WHERE id = ?
      `, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Session methods
  async createSession(sessionData) {
    return new Promise((resolve, reject) => {
      const { id, userId, token, expiresAt } = sessionData;
      
      this.db.run(`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (?, ?, ?, ?)
      `, [id, userId, token, expiresAt], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getSessionByToken(token) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT s.*, u.* FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `, [token], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async deleteSession(token) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM sessions WHERE token = ?', [token], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async deleteExpiredSessions() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM sessions WHERE expires_at <= datetime("now")', function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Voting history methods
  async addVotingRecord(voteData) {
    return new Promise((resolve, reject) => {
      const { id, userId, electionId, candidateId, voteHash, commitment } = voteData;
      
      this.db.run(`
        INSERT INTO voting_history (id, user_id, election_id, candidate_id, vote_hash, commitment)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, userId, electionId, candidateId, voteHash, commitment], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getUserVotingHistory(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM voting_history 
        WHERE user_id = ? 
        ORDER BY voted_at DESC
      `, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getUserStats(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total_votes,
          MAX(voted_at) as last_vote
        FROM voting_history 
        WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Cleanup expired sessions periodically
  startCleanup() {
    setInterval(() => {
      this.deleteExpiredSessions().catch(console.error);
    }, 60 * 60 * 1000); // Run every hour
  }

  close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}

module.exports = new Database(); 
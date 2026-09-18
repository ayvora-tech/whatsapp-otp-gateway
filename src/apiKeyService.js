import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class ApiKeyService {
  constructor() {
    this.keys = [];
    this.loadKeys();
  }

  loadKeys() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
        this.keys = JSON.parse(raw);
      } else {
        // Generate initial default primary key
        const initialKey = this.generateKey('Primary App Key');
        this.keys = [initialKey];
        this.saveKeys();
      }
    } catch (err) {
      console.error('[ApiKeyService] Failed to load keys, initializing fresh:', err.message);
      this.keys = [];
    }
  }

  saveKeys() {
    try {
      fs.writeFileSync(KEYS_FILE, JSON.stringify(this.keys, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ApiKeyService] Failed to save keys:', err.message);
    }
  }

  generateKey(name = 'Default API Key') {
    const randomHex = crypto.randomBytes(24).toString('hex');
    const key = `wotp_live_${randomHex}`;
    const keyRecord = {
      id: crypto.randomUUID(),
      name,
      key,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      isActive: true,
    };
    return keyRecord;
  }

  createKey(name) {
    const keyRecord = this.generateKey(name);
    this.keys.push(keyRecord);
    this.saveKeys();
    return keyRecord;
  }

  getAllKeys() {
    return this.keys.map(k => ({
      id: k.id,
      name: k.name,
      key: k.key,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      isActive: k.isActive,
    }));
  }

  revokeKey(id) {
    const index = this.keys.findIndex(k => k.id === id);
    if (index !== -1) {
      this.keys.splice(index, 1);
      this.saveKeys();
      return true;
    }
    return false;
  }

  validateKey(providedKey) {
    if (!providedKey) return false;
    const cleanKey = providedKey.trim();
    const found = this.keys.find(k => k.key === cleanKey && k.isActive);
    if (found) {
      found.lastUsedAt = new Date().toISOString();
      this.saveKeys();
      return true;
    }
    return false;
  }

  middleware() {
    return (req, res, next) => {
      // Allow key to be passed in x-api-key header, Authorization: Bearer <key>, or apiKey query param
      const authHeader = req.headers['authorization'];
      let apiKey = req.headers['x-api-key'];

      if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7).trim();
      }

      if (!apiKey && req.query.apiKey) {
        apiKey = req.query.apiKey;
      }

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Missing API key. Please provide it via "x-api-key" header or "Authorization: Bearer <key>".',
        });
      }

      if (!this.validateKey(apiKey)) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or revoked API key.',
        });
      }

      next();
    };
  }
}

export const apiKeyService = new ApiKeyService();

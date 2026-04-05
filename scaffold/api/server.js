const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { parseCookies, unsealAuthPayload, setAuthCookie, clearAuthCookie } = require('./auth-cookie');
const { createCorsOptionsDelegate, parseAllowedOrigins } = require('./cors-utils');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = !!process.env.VERCEL;

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}
const ENCRYPTION_KEY = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
const DEFAULT_SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

const log = (...args) => DEBUG && console.log(...args);

// --- Helpers ---

function getUaHash(req) {
  return crypto.createHash('sha256').update(req.headers['user-agent'] || '').digest('hex');
}

function deriveUserId(username) {
  return crypto.createHash('sha256').update(username).digest('hex').slice(0, 16);
}

function getSessionMaxAgeMs(req) {
  const maxAgeMs = Number(req?.session?.cookie?.maxAge);
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) return maxAgeMs;
  return DEFAULT_SESSION_MAX_AGE_MS;
}

// Encryption helpers for session credential storage
const DERIVED_SALT = crypto.createHash('sha256').update(ENCRYPTION_KEY + 'app-salt').digest().slice(0, 16);
const DERIVED_KEY = crypto.scryptSync(ENCRYPTION_KEY, DERIVED_SALT, 32);

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', DERIVED_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted) {
  if (!encrypted) return '';
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', DERIVED_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- Auth cookie persistence ---

function persistAuthCookie(req, res) {
  if (!req?.session?.authenticated || !process.env.SESSION_SECRET) return;
  const maxAgeMs = getSessionMaxAgeMs(req);
  const payload = {
    authenticated: true,
    username: req.session.username,
    userId: req.session.userId,
    uaHash: req.session.uaHash,
    lastActivity: req.session.lastActivity || Date.now(),
    maxAgeMs,
    exp: Date.now() + maxAgeMs
  };
  setAuthCookie(res, payload, ENCRYPTION_KEY, {
    maxAgeMs,
    secure: IS_PRODUCTION,
    httpOnly: true,
    sameSite: 'Strict',
    path: '/'
  });
}

function clearAllAuthState(req, res, done) {
  clearAuthCookie(res, {
    secure: IS_PRODUCTION,
    httpOnly: true,
    sameSite: 'Strict',
    path: '/'
  });
  if (!req.session) {
    if (typeof done === 'function') done();
    return;
  }
  req.session.destroy((err) => {
    if (typeof done === 'function') done(err);
  });
}

// --- Per-user Vercel Blob persistence ---

const blobPrefixCache = new Map();
function blobPrefix(userId) {
  let cached = blobPrefixCache.get(userId);
  if (cached) return cached;
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY).update(userId).digest('hex').slice(0, 12);
  cached = `app-cache/${hmac}-${userId}`;
  blobPrefixCache.set(userId, cached);
  return cached;
}

async function loadUserBlob(userId, key, fallback) {
  if (!IS_PRODUCTION || !userId) return fallback;
  try {
    const { list } = require('@vercel/blob');
    const blobPath = `${blobPrefix(userId)}/${key}.json`;
    const { blobs } = await list({ prefix: blobPath });
    const match = blobs?.find(b => b.pathname === blobPath);
    if (match) {
      const resp = await fetch(match.url);
      return await resp.json();
    }
  } catch (err) {
    log(`[BLOB] Read ${key} failed:`, err.message);
  }
  return fallback;
}

async function saveUserBlob(userId, key, data) {
  if (!IS_PRODUCTION || !userId) return;
  try {
    const { put } = require('@vercel/blob');
    await put(`${blobPrefix(userId)}/${key}.json`, JSON.stringify(data), { access: 'public', addRandomSuffix: false });
  } catch (err) {
    log(`[BLOB] Write ${key} failed:`, err.message);
  }
}

// --- Express middleware stack ---

const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ORIGINS,
  `http://localhost:${PORT},http://127.0.0.1:${PORT}`
);

app.use(cors(createCorsOptionsDelegate(allowedOrigins)));
app.use(express.json());
app.set('trust proxy', 1);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again in 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(session({
  secret: ENCRYPTION_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PRODUCTION,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: DEFAULT_SESSION_MAX_AGE_MS
  }
}));

// Rehydrate session from encrypted auth cookie (serverless-safe)
app.use((req, res, next) => {
  if (req.session?.authenticated) return next();
  if (!process.env.SESSION_SECRET) return next();

  const cookies = parseCookies(req.headers.cookie);
  const authToken = cookies.app_auth;
  if (!authToken) return next();

  const payload = unsealAuthPayload(authToken, ENCRYPTION_KEY);
  if (!payload || !payload.authenticated) {
    clearAuthCookie(res, { secure: IS_PRODUCTION, httpOnly: true, sameSite: 'Strict', path: '/' });
    return next();
  }

  if (payload.exp && Date.now() > payload.exp) {
    clearAuthCookie(res, { secure: IS_PRODUCTION, httpOnly: true, sameSite: 'Strict', path: '/' });
    return next();
  }

  const currentUaHash = getUaHash(req);
  if (payload.uaHash && payload.uaHash !== currentUaHash) {
    clearAuthCookie(res, { secure: IS_PRODUCTION, httpOnly: true, sameSite: 'Strict', path: '/' });
    return next();
  }

  req.session.authenticated = true;
  req.session.username = payload.username;
  req.session.userId = payload.userId;
  req.session.lastActivity = payload.lastActivity || Date.now();
  req.session.uaHash = payload.uaHash || currentUaHash;
  req.session.cookie.maxAge = Number(payload.maxAgeMs) || DEFAULT_SESSION_MAX_AGE_MS;
  return next();
});

// Session idle timeout
app.use((req, res, next) => {
  if (req.session && req.session.authenticated) {
    const lastActivity = req.session.lastActivity || Date.now();
    if (Date.now() - lastActivity > SESSION_IDLE_TIMEOUT_MS) {
      return clearAllAuthState(req, res, () => {
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      });
    }
    req.session.lastActivity = Date.now();
    persistAuthCookie(req, res);
  }
  next();
});

// CSRF origin check
const ALLOWED_ORIGINS = new Set(allowedOrigins);
if (process.env.VERCEL_URL) ALLOWED_ORIGINS.add(`https://${process.env.VERCEL_URL}`);

app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (origin) {
    if (ALLOWED_ORIGINS.has(origin)) return next();
    log(`[CSRF] Blocked request from origin: ${origin}`);
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  const referer = req.headers.referer;
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.has(refOrigin)) return next();
      log(`[CSRF] Blocked request from referer: ${referer}`);
      return res.status(403).json({ error: 'Origin not allowed' });
    } catch { /* invalid referer */ }
  }
  // No Origin or Referer -- allow for non-browser clients (iOS native, curl)
  return next();
});

// Security headers
const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'";
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', CSP_HEADER);
  }
  next();
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    if (req.session.uaHash) {
      const currentUaHash = getUaHash(req);
      if (currentUaHash !== req.session.uaHash) {
        return clearAllAuthState(req, res, () => {
          return res.status(401).json({ error: 'Session invalid. Please login again.' });
        });
      }
    }
    next();
  } else {
    res.status(401).sendFile(path.join(__dirname, '../web/login.html'));
  }
};

// --- Routes ---

// Lightweight session check (no external roundtrip)
app.get('/api/session-check', (req, res) => {
  if (req.session?.authenticated) {
    return res.json({ authenticated: true, userId: req.session.userId });
  }
  return res.status(401).json({ authenticated: false });
});

// Login
// TODO: Replace validateCredentials() with your auth provider
async function validateCredentials(username, password) {
  // Stub -- replace with your auth logic (database lookup, external API, etc.)
  // Return { success: true } or { success: false, error: 'reason' }
  return { success: false, error: 'Auth not configured' };
}

app.post('/api/login', loginLimiter, async (req, res) => {
  let { username, password, rememberMe } = req.body;

  if (username && (typeof username !== 'string' || username.length > 200)) {
    return res.status(400).json({ success: false, error: 'Invalid credentials' });
  }
  if (password && (typeof password !== 'string' || password.length > 200)) {
    return res.status(400).json({ success: false, error: 'Invalid credentials' });
  }
  if (username) username = username.trim();
  if (password) password = password.trim();

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  try {
    const result = await validateCredentials(username, password);
    if (!result.success) {
      return res.status(401).json({ success: false, error: result.error || 'Invalid credentials' });
    }

    req.session.authenticated = true;
    req.session.username = username;
    req.session.userId = deriveUserId(username);
    req.session.lastActivity = Date.now();
    req.session.uaHash = getUaHash(req);

    if (rememberMe) {
      req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
    } else {
      req.session.cookie.maxAge = DEFAULT_SESSION_MAX_AGE_MS;
    }

    req.session.save((saveError) => {
      if (saveError) {
        console.error('[LOGIN] Session save error:', saveError);
        return res.status(500).json({ success: false, error: 'Failed to create session.' });
      }
      persistAuthCookie(req, res);
      res.json({ success: true });
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  clearAllAuthState(req, res, (error) => {
    if (error) {
      console.error('[LOGOUT] Session destroy error:', error);
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    res.json({ success: true });
  });
});

// Current user info
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    username: req.session.username || 'User'
  });
});

// --- Add your app routes here ---
// Example:
// app.get('/api/data', requireAuth, async (req, res) => {
//   const userId = req.session.userId;
//   const data = await loadUserBlob(userId, 'my-data', { items: [] });
//   res.json(data);
// });

// --- Static files + SPA ---

app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/app');
  }
  return res.redirect('/login.html');
});

app.get('/app', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.redirect('/login.html');
  }
  // TODO: serve your authenticated page
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

app.use(express.static(path.join(__dirname, '../web'), {
  index: false,
  setHeaders: (res, filePath) => {
    if (/\.(svg|png|jpg|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// --- Start ---

const isServerlessRuntime = !!process.env.LAMBDA_TASK_ROOT;
if (isServerlessRuntime) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    log(`[API] Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

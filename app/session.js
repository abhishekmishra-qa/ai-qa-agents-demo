// Bearer tokens for the demo: random per login, kept in memory only, gone when the app stops.
const crypto = require('node:crypto');
const store = require('./store');

const sessions = new Map(); // token -> user id

function issueToken(user) {
  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  return token;
}

// Runs before every /api route except login.
function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  // No user for unknown tokens, and none for users removed after they logged in.
  const user = store.findUser(sessions.get(token));
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  next();
}

module.exports = { issueToken, requireAuth };

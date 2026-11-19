const express = require('express');
const store = require('../store');
const { issueToken } = require('../session');

const router = express.Router();

// POST /api/login { email } -> { token, user }
// Email only, on purpose: this demo tests the role rules, not real authentication.
router.post('/login', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  const user = store.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Unknown user' });
  }
  res.json({ token: issueToken(user), user });
});

module.exports = router;

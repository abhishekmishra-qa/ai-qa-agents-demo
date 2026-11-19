const express = require('express');
const store = require('../store');
const { isAdminOrOwner } = require('../roles');

const router = express.Router();

// Only the Owner and Admins manage members. This guard covers every route in this file.
router.use((req, res, next) => {
  if (!isAdminOrOwner(req.user)) {
    return res.status(403).json({ error: 'Only the Owner or an Admin can manage members' });
  }
  next();
});

// POST /api/members { email, role }
router.post('/', (req, res) => {
  const { email, role } = req.body || {};
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'a valid email is required' });
  }
  // A workspace has exactly one Owner, and guests are not members, so only these two roles.
  if (role !== 'Admin' && role !== 'Member') {
    return res.status(400).json({ error: 'role must be Admin or Member' });
  }
  if (store.findUserByEmail(email)) {
    return res.status(409).json({ error: 'that email is already in use' });
  }
  res.status(201).json(store.addUser({ email, role }));
});

// DELETE /api/members/:id
router.delete('/:id', (req, res) => {
  const member = store.findUser(req.params.id);
  if (!member || member.role === 'Guest') {
    return res.status(404).json({ error: 'Member not found' });
  }
  // Without an Owner nobody could ever manage the workspace again.
  if (member.role === 'Owner') {
    return res.status(403).json({ error: 'The Owner cannot be removed' });
  }
  store.removeUser(member.id);
  res.status(204).end();
});

module.exports = router;

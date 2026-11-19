const express = require('express');
const store = require('../store');
const { isAdminOrOwner, isGuest } = require('../roles');
const { BUGGY } = require('../config');

const router = express.Router();

// Workspace members see every doc. Guests see only the docs shared with them.
function canSee(user, doc) {
  return !isGuest(user) || doc.sharedWith.includes(user.id);
}

// A doc you can't see gets the same 404 as a missing one,
// so a guest can't find out which doc ids exist by trying them.
function findVisibleDoc(req, res) {
  const doc = store.findDoc(req.params.id);
  if (!doc || !canSee(req.user, doc)) {
    res.status(404).json({ error: 'Doc not found' });
    return null;
  }
  return doc;
}

// Returns what's wrong with the input, or null if it's fine. On edit, both fields are optional.
function inputProblem({ title, content }, isEdit) {
  if (title === undefined && !isEdit) return 'title is required';
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) return 'title must be non-empty text';
  if (content !== undefined && typeof content !== 'string') return 'content must be text';
  return null;
}

// GET /api/docs
router.get('/', (req, res) => {
  res.json(store.docs.filter((doc) => canSee(req.user, doc)));
});

// POST /api/docs { title, content? }
router.post('/', (req, res) => {
  if (isGuest(req.user)) {
    return res.status(403).json({ error: 'Guests have read-only access' });
  }
  const input = req.body || {};
  const problem = inputProblem(input, false);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  const doc = store.addDoc({ title: input.title.trim(), content: input.content || '', ownerId: req.user.id });
  res.status(201).json(doc);
});

// GET /api/docs/:id
router.get('/:id', (req, res) => {
  const doc = findVisibleDoc(req, res);
  if (doc) res.json(doc);
});

// PATCH /api/docs/:id { title?, content? }
router.patch('/:id', (req, res) => {
  const doc = findVisibleDoc(req, res);
  if (!doc) return;
  // Read-only means read-only, even on docs that were shared with the guest.
  if (isGuest(req.user)) {
    return res.status(403).json({ error: 'Guests have read-only access' });
  }
  const input = req.body || {};
  const problem = inputProblem(input, true);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  if (input.title !== undefined) doc.title = input.title.trim();
  if (input.content !== undefined) doc.content = input.content;
  res.json(doc);
});

// DELETE /api/docs/:id
router.delete('/:id', (req, res) => {
  const doc = findVisibleDoc(req, res);
  if (!doc) return;
  if (isGuest(req.user)) {
    return res.status(403).json({ error: 'Guests have read-only access' });
  }
  // Deleting is destructive, so Members may delete only their own docs. Owner and Admins may delete any.
  // PLANTED BUG #1: with BUGGY=1 this check is skipped, so any Member can delete anyone's doc.
  const mayDelete = isAdminOrOwner(req.user) || doc.ownerId === req.user.id;
  if (!mayDelete && !BUGGY) {
    return res.status(403).json({ error: 'Members can only delete their own docs' });
  }
  store.removeDoc(doc.id);
  res.status(204).end();
});

module.exports = router;

const express = require('express');
const store = require('../store');
const { isGuest } = require('../roles');
const { BUGGY } = require('../config');

const router = express.Router();

// Any workspace member may share any doc (they can all read and edit it anyway).
// Guests are stopped first, before we even look the doc up.
function findDocToShare(req, res) {
  if (isGuest(req.user)) {
    res.status(403).json({ error: 'Guests cannot share docs' });
    return null;
  }
  const doc = store.findDoc(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Doc not found' });
    return null;
  }
  return doc;
}

// POST /api/docs/:id/share { userId } -> gives that guest read access
router.post('/:id/share', (req, res) => {
  const doc = findDocToShare(req, res);
  if (!doc) return;
  const target = store.findUser((req.body || {}).userId);
  // Members already see every doc, so sharing only makes sense for guests.
  if (!target || !isGuest(target)) {
    return res.status(400).json({ error: 'userId must be a guest user' });
  }
  if (!doc.sharedWith.includes(target.id)) doc.sharedWith.push(target.id);
  res.json(doc);
});

// DELETE /api/docs/:id/share/:userId -> takes that guest's access away
router.delete('/:id/share/:userId', (req, res) => {
  const doc = findDocToShare(req, res);
  if (!doc) return;
  // PLANTED BUG #2: with BUGGY=1 we answer 204 "done" but the guest keeps access.
  if (!BUGGY) {
    doc.sharedWith = doc.sharedWith.filter((id) => id !== req.params.userId);
  }
  res.status(204).end();
});

module.exports = router;

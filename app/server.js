// Entry point: wires the routes together and starts the API.
const express = require('express');
const { PORT, BUGGY } = require('./config');
const { requireAuth } = require('./session');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, buggy: BUGGY }));

app.use('/api', require('./routes/auth')); // POST /api/login needs no token
app.use('/api', requireAuth); // every route below this line does
app.use('/api/docs', require('./routes/docs'));
app.use('/api/docs', require('./routes/sharing'));
app.use('/api/members', require('./routes/members'));

// Unknown routes and errors (like malformed JSON) answer in JSON too, so tests can always read `error`.
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message : 'Internal error' });
});

// Localhost only: it's a demo, nothing outside this machine needs to reach it.
// Express 5 also calls this callback on startup errors (like a busy port), so fail loudly.
app.listen(PORT, '127.0.0.1', (err) => {
  if (err) throw err;
  console.log(`Demo workspace API on http://127.0.0.1:${PORT}${BUGGY ? ' (BUGGY=1: planted bugs ON)' : ''}`);
});

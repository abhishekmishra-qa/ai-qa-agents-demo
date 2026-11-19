// In-memory data. Every app start begins from the same seed, so test runs never depend on each other.

// One user per role, plus a second Member so "someone else's doc" can be tested.
// Fake example.com addresses. The demo logs in by email only, so there are no credentials to leak.
const users = [
  { id: 'u1', email: 'owner@example.com', role: 'Owner' },
  { id: 'u2', email: 'admin@example.com', role: 'Admin' },
  { id: 'u3', email: 'member@example.com', role: 'Member' },
  { id: 'u4', email: 'member2@example.com', role: 'Member' },
  { id: 'u5', email: 'guest@example.com', role: 'Guest' },
];

const docs = [
  { id: 'doc1', title: 'Welcome to the demo workspace', content: 'Seed data.', ownerId: 'u1', sharedWith: [] },
];

let nextUserNumber = users.length + 1;
let nextDocNumber = docs.length + 1;

// " Member@Example.com" and "member@example.com" are the same person.
const normalize = (email) => email.trim().toLowerCase();

// Removes in place (no new array), so every module holding `docs` sees the change.
function removeById(list, id) {
  const index = list.findIndex((item) => item.id === id);
  if (index !== -1) list.splice(index, 1);
}

module.exports = {
  docs,

  findUser: (id) => users.find((user) => user.id === id),
  findUserByEmail: (email) => users.find((user) => user.email === normalize(email)),
  addUser({ email, role }) {
    const user = { id: `u${nextUserNumber++}`, email: normalize(email), role };
    users.push(user);
    return user;
  },
  removeUser: (id) => removeById(users, id),

  findDoc: (id) => docs.find((doc) => doc.id === id),
  addDoc({ title, content, ownerId }) {
    const doc = { id: `doc${nextDocNumber++}`, title, content, ownerId, sharedWith: [] };
    docs.push(doc);
    return doc;
  },
  removeDoc: (id) => removeById(docs, id),
};

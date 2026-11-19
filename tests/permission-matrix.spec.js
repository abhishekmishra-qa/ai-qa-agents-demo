// The role x action permission matrix, data-driven: each row becomes one test per role.
// This table is the spec. It matches the matrix in README.md, so change both together.
const { test, expect, uniqueEmail } = require('./fixtures');

const MATRIX = [
  {
    action: 'create a doc',
    tag: '@docs',
    expected: { Owner: 201, Admin: 201, Member: 201, Guest: 403 },
    async run({ api, cleanup }) {
      const res = await api.post('/api/docs', { data: { title: 'Matrix doc' } });
      if (res.status() === 201) cleanup.doc((await res.json()).id);
      return res;
    },
  },
  {
    action: "delete another member's doc",
    tag: '@docs',
    expected: { Owner: 204, Admin: 204, Member: 403, Guest: 403 },
    async run({ api, newDoc }) {
      // Shared with the Guest so every role can see it. Then 403 means "not allowed", not "not found".
      const doc = await newDoc('OtherMember', { shareWithGuest: true });
      return api.delete(`/api/docs/${doc.id}`);
    },
  },
  {
    action: 'add a workspace member',
    tag: '@members',
    expected: { Owner: 201, Admin: 201, Member: 403, Guest: 403 },
    async run({ api, cleanup }) {
      const res = await api.post('/api/members', { data: { email: uniqueEmail(), role: 'Member' } });
      if (res.status() === 201) cleanup.member((await res.json()).id);
      return res;
    },
  },
];

for (const row of MATRIX) {
  for (const [role, status] of Object.entries(row.expected)) {
    const verb = status < 400 ? 'can' : 'cannot';
    test(`${role} ${verb} ${row.action} (${status})`, { tag: row.tag }, async ({ loginAs, cleanup, newDoc }) => {
      const api = await loginAs(role);
      const res = await row.run({ api, cleanup, newDoc });
      expect(res.status(), `${role} tries to ${row.action}`).toBe(status);
    });
  }
}

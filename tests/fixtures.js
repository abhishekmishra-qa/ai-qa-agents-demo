// Shared test helpers. Specs import { test, expect } from here instead of from '@playwright/test'.
const crypto = require('node:crypto');
const base = require('@playwright/test');

const { expect } = base;

// The seeded users from app/store.js. Fake addresses: the demo app logs in by email only.
const USERS = {
  Owner: { id: 'u1', email: 'owner@example.com' },
  Admin: { id: 'u2', email: 'admin@example.com' },
  Member: { id: 'u3', email: 'member@example.com' },
  OtherMember: { id: 'u4', email: 'member2@example.com' },
  Guest: { id: 'u5', email: 'guest@example.com' },
};

// Unique values keep tests apart while they run in parallel against one app.
const uniqueEmail = () => `qa-${crypto.randomUUID().slice(0, 8)}@example.com`;

const test = base.test.extend({
  // loginAs('Member') or loginAs('someone@example.com') -> an API client that sends that user's token.
  loginAs: async ({ playwright, request, baseURL }, use) => {
    const clients = {};
    await use(async (who) => {
      const email = USERS[who] ? USERS[who].email : who;
      if (!clients[email]) {
        const res = await request.post('/api/login', { data: { email } });
        expect(res.status(), `log in as ${who}`).toBe(200);
        const { token } = await res.json();
        clients[email] = await playwright.request.newContext({
          baseURL,
          extraHTTPHeaders: { Authorization: `Bearer ${token}` },
        });
      }
      return clients[email];
    });
    for (const client of Object.values(clients)) await client.dispose();
  },

  // cleanup.doc(id) / cleanup.member(id): deleted after the test, even when the test fails.
  // The Owner does the deleting, because the Owner may delete anything.
  cleanup: async ({ loginAs }, use) => {
    const paths = [];
    await use({
      doc: (id) => paths.push(`/api/docs/${id}`),
      member: (id) => paths.push(`/api/members/${id}`),
    });
    const owner = await loginAs('Owner');
    for (const path of paths) {
      const res = await owner.delete(path);
      // 404 is fine: the test may have deleted it already.
      expect([204, 404], `clean up ${path}`).toContain(res.status());
    }
  },

  // newDoc('Member') creates a doc as that user and registers it for cleanup.
  // newDoc('Member', { shareWithGuest: true }) also gives the seeded Guest read access.
  newDoc: async ({ loginAs, cleanup }, use) => {
    await use(async (who, { shareWithGuest = false } = {}) => {
      const author = await loginAs(who);
      const res = await author.post('/api/docs', {
        data: { title: `Test doc ${crypto.randomUUID().slice(0, 8)}`, content: 'Created by a test' },
      });
      expect(res.status(), `${who} creates a doc`).toBe(201);
      const doc = await res.json();
      cleanup.doc(doc.id);
      if (shareWithGuest) {
        const shared = await author.post(`/api/docs/${doc.id}/share`, { data: { userId: USERS.Guest.id } });
        expect(shared.status(), 'share the doc with the Guest').toBe(200);
      }
      return doc;
    });
  },
});

module.exports = { test, expect, USERS, uniqueEmail };

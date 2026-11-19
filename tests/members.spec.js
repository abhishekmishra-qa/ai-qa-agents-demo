const { test, expect, USERS, uniqueEmail } = require('./fixtures');

test.describe('workspace members', { tag: '@members' }, () => {
  test('Admin can remove a member, and their token stops working', async ({ loginAs, cleanup }) => {
    const admin = await loginAs('Admin');
    const email = uniqueEmail();

    const added = await admin.post('/api/members', { data: { email, role: 'Member' } });
    expect(added.status()).toBe(201);
    const member = await added.json();
    cleanup.member(member.id);

    const newcomer = await loginAs(email);
    expect((await newcomer.get('/api/docs')).status()).toBe(200);

    expect((await admin.delete(`/api/members/${member.id}`)).status()).toBe(204);
    // Removing someone must also end the session they already have, not just block new logins.
    expect((await newcomer.get('/api/docs')).status()).toBe(401);
  });

  test('the Owner cannot be removed', async ({ loginAs }) => {
    const admin = await loginAs('Admin');
    // If this ever fails, the Owner really is gone and later tests fail too: fix this one first.
    const res = await admin.delete(`/api/members/${USERS.Owner.id}`);
    expect(res.status()).toBe(403);
  });

  test('adding a member rejects bad input (400) and duplicates (409)', async ({ loginAs }) => {
    const admin = await loginAs('Admin');
    const cases = [
      { name: 'missing email', data: { role: 'Member' }, status: 400 },
      { name: 'unknown role', data: { email: uniqueEmail(), role: 'Superuser' }, status: 400 },
      { name: 'a second Owner', data: { email: uniqueEmail(), role: 'Owner' }, status: 400 },
      { name: 'email already in use', data: { email: USERS.Member.email, role: 'Member' }, status: 409 },
    ];
    for (const { name, data, status } of cases) {
      await test.step(name, async () => {
        const res = await admin.post('/api/members', { data });
        expect(res.status()).toBe(status);
      });
    }
  });
});

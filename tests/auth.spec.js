const { test, expect, USERS } = require('./fixtures');

test.describe('login and tokens', { tag: '@auth' }, () => {
  test('login returns a bearer token and the right user for every role', async ({ request }) => {
    for (const role of ['Owner', 'Admin', 'Member', 'Guest']) {
      await test.step(role, async () => {
        const res = await request.post('/api/login', { data: { email: USERS[role].email } });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(typeof body.token).toBe('string');
        // toEqual, not toMatchObject: a new field leaking into the user (say, a hash) should fail here.
        expect(body.user).toEqual({ id: USERS[role].id, email: USERS[role].email, role });
      });
    }
  });

  test('login rejects a missing email (400) and an unknown one (401)', async ({ request }) => {
    const missing = await request.post('/api/login', { data: {} });
    expect(missing.status()).toBe(400);

    const unknown = await request.post('/api/login', { data: { email: 'nobody@example.com' } });
    expect(unknown.status()).toBe(401);
  });

  test('requests without a valid token get 401', async ({ request }) => {
    const attempts = {
      'no Authorization header': {},
      'made-up token': { Authorization: 'Bearer made-up-value' },
      'wrong scheme': { Authorization: 'Basic not-a-bearer-value' },
    };
    for (const [name, headers] of Object.entries(attempts)) {
      await test.step(name, async () => {
        const res = await request.get('/api/docs', { headers });
        expect(res.status()).toBe(401);
      });
    }
  });
});

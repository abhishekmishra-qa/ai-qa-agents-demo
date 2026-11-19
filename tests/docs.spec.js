const { test, expect, USERS } = require('./fixtures');

test.describe('docs', { tag: '@docs' }, () => {
  test('Member can create, read, edit and delete their own doc', async ({ loginAs, cleanup }) => {
    const member = await loginAs('Member');

    const doc = await test.step('create', async () => {
      const res = await member.post('/api/docs', { data: { title: 'Release checklist', content: 'v1' } });
      expect(res.status()).toBe(201);
      const created = await res.json();
      cleanup.doc(created.id); // registered right away, so a failing later step still cleans up
      expect(created).toMatchObject({ title: 'Release checklist', content: 'v1', ownerId: USERS.Member.id });
      return created;
    });

    await test.step('read', async () => {
      const res = await member.get(`/api/docs/${doc.id}`);
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ id: doc.id, title: 'Release checklist' });
    });

    await test.step('edit', async () => {
      const res = await member.patch(`/api/docs/${doc.id}`, { data: { content: 'v2' } });
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ title: 'Release checklist', content: 'v2' });
    });

    await test.step('delete', async () => {
      expect((await member.delete(`/api/docs/${doc.id}`)).status()).toBe(204);
      // Check the effect, not just the status code: the doc must really be gone.
      expect((await member.get(`/api/docs/${doc.id}`)).status()).toBe(404);
    });
  });

  test('bad input returns 400 with a reason', async ({ loginAs, newDoc }) => {
    const member = await loginAs('Member');
    const doc = await newDoc('Member');
    const badRequests = {
      'create without a title': () => member.post('/api/docs', { data: { content: 'no title' } }),
      'create with a blank title': () => member.post('/api/docs', { data: { title: '   ' } }),
      'create with content that is not text': () => member.post('/api/docs', { data: { title: 'Notes', content: 42 } }),
      'edit to a blank title': () => member.patch(`/api/docs/${doc.id}`, { data: { title: '' } }),
      'malformed JSON': () =>
        member.post('/api/docs', { headers: { 'Content-Type': 'application/json' }, data: '{"title": ' }),
    };
    for (const [name, send] of Object.entries(badRequests)) {
      await test.step(name, async () => {
        const res = await send();
        expect(res.status()).toBe(400);
        expect(await res.json()).toHaveProperty('error');
      });
    }
  });

  test('an unknown doc id returns 404', async ({ loginAs }) => {
    // As the Owner, who can see every doc, so 404 here can only mean "does not exist".
    const owner = await loginAs('Owner');
    expect((await owner.get('/api/docs/no-such-doc')).status()).toBe(404);
    expect((await owner.patch('/api/docs/no-such-doc', { data: { title: 'New title' } })).status()).toBe(404);
    expect((await owner.delete('/api/docs/no-such-doc')).status()).toBe(404);
  });
});

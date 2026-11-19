const { test, expect, USERS } = require('./fixtures');

test.describe('sharing with guests', { tag: '@sharing' }, () => {
  test('Guest can read a doc shared with them, but cannot edit it', async ({ loginAs, newDoc }) => {
    const member = await loginAs('Member');
    const guest = await loginAs('Guest');
    const doc = await newDoc('Member');

    const shared = await member.post(`/api/docs/${doc.id}/share`, { data: { userId: USERS.Guest.id } });
    expect(shared.status()).toBe(200);
    expect((await guest.get(`/api/docs/${doc.id}`)).status()).toBe(200);

    const edit = await guest.patch(`/api/docs/${doc.id}`, { data: { title: 'Edited by the guest' } });
    expect(edit.status()).toBe(403);
    // A 403 must also mean nothing changed.
    expect((await (await member.get(`/api/docs/${doc.id}`)).json()).title).toBe(doc.title);
  });

  test('Guest cannot see docs that were not shared with them', async ({ loginAs, newDoc }) => {
    const guest = await loginAs('Guest');
    const sharedDoc = await newDoc('Member', { shareWithGuest: true });
    const privateDoc = await newDoc('Member');

    const list = await guest.get('/api/docs');
    expect(list.status()).toBe(200);
    const ids = (await list.json()).map((doc) => doc.id);
    expect(ids).toContain(sharedDoc.id);
    expect(ids).not.toContain(privateDoc.id);

    // 404, not 403: a guest shouldn't even learn that the doc exists.
    expect((await guest.get(`/api/docs/${privateDoc.id}`)).status()).toBe(404);
  });

  test('removing a guest really takes their access away', async ({ loginAs, newDoc }) => {
    const member = await loginAs('Member');
    const guest = await loginAs('Guest');
    const doc = await newDoc('Member', { shareWithGuest: true });
    expect((await guest.get(`/api/docs/${doc.id}`)).status()).toBe(200);

    const removed = await member.delete(`/api/docs/${doc.id}/share/${USERS.Guest.id}`);
    expect(removed.status()).toBe(204);
    // A 204 alone proves nothing: check that the guest is actually locked out.
    const after = await guest.get(`/api/docs/${doc.id}`);
    expect(after.status(), 'Guest opens the doc after their access was removed').toBe(404);
  });

  test('only workspace members can share, and only with guests', async ({ loginAs, newDoc }) => {
    const doc = await newDoc('Member', { shareWithGuest: true });

    await test.step('Guest cannot share a doc (403)', async () => {
      const guest = await loginAs('Guest');
      const res = await guest.post(`/api/docs/${doc.id}/share`, { data: { userId: USERS.Guest.id } });
      expect(res.status()).toBe(403);
    });

    await test.step('sharing with a Member is rejected (400)', async () => {
      const member = await loginAs('Member');
      const res = await member.post(`/api/docs/${doc.id}/share`, { data: { userId: USERS.OtherMember.id } });
      expect(res.status()).toBe(400);
    });
  });
});

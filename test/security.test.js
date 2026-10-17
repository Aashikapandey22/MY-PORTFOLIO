import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../middleware/auth.js';

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('admin middleware rejects missing credentials', async () => {
  const res = response();
  await createAuthMiddleware({ clients: {}, adminIds: new Set(['admin']) })({ headers: {} }, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 401);
});

test('admin middleware rejects an authenticated non-admin', async () => {
  const res = response();
  const clients = { auth: { getUser: async () => ({ data: { user: { id: 'visitor' } }, error: null }) } };
  await createAuthMiddleware({ clients, adminIds: new Set(['admin']) })({ headers: { authorization: 'Bearer test-token' } }, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 403);
});

test('admin middleware forwards an allowlisted administrator', async () => {
  const res = response(); let nextCalled = false;
  const clients = { auth: { getUser: async (token) => ({ data: { user: { id: 'admin', email: 'admin@example.test' } }, error: token !== 'test-token' ? new Error('bad token') : null }) } };
  const request = { headers: { authorization: 'Bearer test-token' } };
  await createAuthMiddleware({ clients, adminIds: new Set(['admin']) })(request, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(request.user.id, 'admin');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';

const testUser = { id: 'user-123', name: 'Taylor Student', email: 'taylor@example.com' };
const testSecret = 'test-secret-for-api-tests';

const auth = {
  register: async ({ name, email }) => ({
    user: { ...testUser, name: name.trim(), email: email.trim().toLowerCase() },
    token: 'test-register-token',
  }),
  login: async ({ email }) => ({ user: { ...testUser, email: email.toLowerCase() }, token: 'test-login-token' }),
  publicUser: (user) => ({ id: user.id, name: user.name, email: user.email }),
};

const app = createApp({ auth, findUserById: async (id) => (id === testUser.id ? testUser : null), jwtSecret: () => testSecret });

test('register validates the required account details', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'T', email: 'not-an-email', password: 'short' });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /valid email/i);
});

test('register creates a user response without returning a password', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Taylor Student', email: 'TAYLOR@example.com', password: 'long-enough-password' });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.user, testUser);
  assert.equal(response.body.token, 'test-register-token');
  assert.equal('password' in response.body.user, false);
});

test('login rejects invalid passwords before calling the auth service', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'taylor@example.com', password: 'short' });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /8 and 72 characters/i);
});

test('login returns a user and token for valid-shaped credentials', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'TAYLOR@example.com', password: 'long-enough-password' });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, testUser.email);
  assert.equal(response.body.token, 'test-login-token');
});

test('current-user endpoint requires a valid bearer token', async () => {
  const denied = await request(app).get('/api/auth/me');
  assert.equal(denied.status, 401);

  const token = jwt.sign({}, testSecret, { subject: testUser.id, expiresIn: '1m' });
  const allowed = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.body.user, testUser);
});
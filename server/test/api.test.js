// Backend API integration tests (framework-agnostic assertions against the HTTP surface).
// Run with: node --test server/test/
//
// Requires a reachable MongoDB. Set MONGO_HOST (defaults to mongodb://localhost/mean),
// JWT_SECRET, and NODE_ENV=test in the environment before running.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const build = require('../config/express');

let app;
let baseUrl;

// A unique email per run so repeated runs do not collide on the unique index.
const uniqueEmail = `tester_${Date.now()}@example.com`;
const validUser = {
  fullname: 'Test User',
  email: uniqueEmail,
  mobileNumber: '1234567890',
  password: 'secret123',
  repeatPassword: 'secret123',
};

let issuedToken;

test.before(async () => {
  const mongoUri = process.env.MONGO_HOST || 'mongodb://localhost/mean';
  await mongoose.connect(mongoUri);
  // Clean any leftover test user.
  await mongoose.connection
    .collection('users')
    .deleteMany({ email: uniqueEmail });

  app = build();
  await app.ready();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await mongoose.connection
    .collection('users')
    .deleteMany({ email: uniqueEmail });
  if (app) {
    await app.close();
  }
  await mongoose.disconnect();
});

async function req(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = undefined;
  }
  return { status: res.status, text, json };
}

test('GET /api/health-check returns 200 OK plain text', async () => {
  const res = await req('GET', '/api/health-check');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'OK');
});

test('POST /api/auth/register creates user and returns {user, token} without hashedPassword', async () => {
  const res = await req('POST', '/api/auth/register', { body: validUser });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json, 'expected JSON body');
  assert.ok(res.json.user, 'expected user in response');
  assert.ok(res.json.token, 'expected token in response');
  assert.strictEqual(res.json.user.email, uniqueEmail);
  assert.strictEqual(res.json.user.fullname, 'Test User');
  assert.strictEqual(
    res.json.user.hashedPassword,
    undefined,
    'hashedPassword must not be exposed'
  );
  assert.ok(res.json.user._id, 'expected _id on user');
  issuedToken = res.json.token;
});

test('POST /api/auth/register with mismatched passwords returns 400 with Joi message', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: {
      fullname: 'Bad User',
      email: `bad_${Date.now()}@example.com`,
      mobileNumber: '1234567890',
      password: 'secret123',
      repeatPassword: 'different',
    },
  });
  assert.strictEqual(res.status, 400);
  assert.ok(res.json, 'expected JSON body');
  assert.match(res.json.message, /repeatPassword/);
});

test('POST /api/auth/login with valid credentials returns {user, token}', async () => {
  const res = await req('POST', '/api/auth/login', {
    body: { email: uniqueEmail, password: 'secret123' },
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.user, 'expected user');
  assert.ok(res.json.token, 'expected token');
  assert.strictEqual(res.json.user.email, uniqueEmail);
  assert.strictEqual(res.json.user.hashedPassword, undefined);
});

test('POST /api/auth/login with wrong password returns 401', async () => {
  const res = await req('POST', '/api/auth/login', {
    body: { email: uniqueEmail, password: 'wrongpassword' },
  });
  assert.strictEqual(res.status, 401);
});

test('GET /api/auth/me with valid token returns {user, token}', async () => {
  const res = await req('GET', '/api/auth/me', { token: issuedToken });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.user, 'expected user');
  assert.ok(res.json.token, 'expected token');
  assert.strictEqual(res.json.user.email, uniqueEmail);
});

test('GET /api/auth/me without token returns 401', async () => {
  const res = await req('GET', '/api/auth/me');
  assert.strictEqual(res.status, 401);
});

test('POST /api/user without token returns 401', async () => {
  const res = await req('POST', '/api/user', {
    body: {
      fullname: 'Another User',
      email: `another_${Date.now()}@example.com`,
      mobileNumber: '1234567890',
      password: 'secret123',
      repeatPassword: 'secret123',
    },
  });
  assert.strictEqual(res.status, 401);
});

test('GET unknown /api route returns 404', async () => {
  const res = await req('GET', '/api/does-not-exist');
  assert.strictEqual(res.status, 404);
});

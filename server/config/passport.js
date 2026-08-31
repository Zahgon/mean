const bcrypt = require('bcrypt');
const httpError = require('http-errors');

const User = require('../models/user.model');
const config = require('./config');

// Verify local (email/password) credentials.
// Returns the user object without hashedPassword, or throws a 401.
async function verifyLocal(email, password) {
  let user = await User.findOne({ email });
  if (!user || !bcrypt.compareSync(password, user.hashedPassword)) {
    throw new httpError(401);
  }
  user = user.toObject();
  delete user.hashedPassword;
  return user;
}

// Extract a bearer token from the Authorization header.
function extractBearerToken(req) {
  const header = req.headers['authorization'];
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/.exec(header);
  return match ? match[1] : null;
}

// Verify a JWT payload and load the matching user (without hashedPassword).
async function verifyJwtPayload(payload) {
  if (!payload || !payload._id) {
    return null;
  }
  let user = await User.findById(payload._id);
  if (!user) {
    return null;
  }
  user = user.toObject();
  delete user.hashedPassword;
  return user;
}

// Fastify preHandler enforcing local (email/password) authentication.
async function authenticateLocal(req, reply) {
  const body = req.body || {};
  req.user = await verifyLocal(body.email, body.password);
}

// Fastify preHandler enforcing JWT authentication.
async function authenticateJwt(req, reply) {
  const jwt = require('jsonwebtoken');
  const token = extractBearerToken(req);
  if (!token) {
    throw new httpError(401);
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (e) {
    throw new httpError(401);
  }
  const user = await verifyJwtPayload(payload);
  if (!user) {
    throw new httpError(401);
  }
  req.user = user;
}

// Registers auth helpers on the Fastify instance (parity with passport.initialize()).
function initialize(app) {
  app.decorate('authenticateLocal', authenticateLocal);
  app.decorate('authenticateJwt', authenticateJwt);
}

module.exports = {
  initialize,
  authenticateLocal,
  authenticateJwt,
  verifyLocal,
  verifyJwtPayload,
};

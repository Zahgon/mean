const userCtrl = require('../controllers/user.controller');
const authCtrl = require('../controllers/auth.controller');
const { authenticateLocal, authenticateJwt } = require('../config/passport');

// Auth plugin (mounted under /api/auth).
async function router(app) {
  app.post('/register', { preHandler: register }, login);
  app.post('/login', { preHandler: authenticateLocal }, login);
  app.get('/me', { preHandler: authenticateJwt }, login);
}

async function register(req, reply) {
  let user = await userCtrl.insert(req.body);
  user = user.toObject();
  delete user.hashedPassword;
  req.user = user;
}

function login(req, reply) {
  const user = req.user;
  const token = authCtrl.generateToken(user);
  return reply.send({ user, token });
}

module.exports = router;

const userCtrl = require('../controllers/user.controller');
const { authenticateJwt } = require('../config/passport');

// User plugin (mounted under /api/user). All routes require JWT auth.
async function router(app) {
  app.addHook('preHandler', authenticateJwt);

  app.post('/', insert);
}

async function insert(req, reply) {
  const user = await userCtrl.insert(req.body);
  return reply.send(user);
}

module.exports = router;

const userRoutes = require('./user.route');
const authRoutes = require('./auth.route');

// Root API plugin (mounted under /api by config/express.js).
async function router(app) {
  /** GET /health-check - Check service health */
  app.get('/health-check', (req, reply) => reply.send('OK'));

  app.register(authRoutes, { prefix: '/auth' });
  app.register(userRoutes, { prefix: '/user' });
}

module.exports = router;

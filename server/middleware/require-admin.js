const httpError = require('http-errors');

// Fastify preHandler that allows only users with the 'admin' role.
const requireAdmin = async function (req, reply) {
  if (req.user && req.user.roles.indexOf('admin') > -1) {
    return;
  }
  throw new httpError(401);
};

module.exports = requireAdmin;

const path = require('path');
const httpError = require('http-errors');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const fastifyCookie = require('@fastify/cookie');
const fastifyCompress = require('@fastify/compress');
const fastifyHelmet = require('@fastify/helmet');
const fastifyCors = require('@fastify/cors');
const fastifyFormbody = require('@fastify/formbody');
const fastifySwagger = require('@fastify/swagger');
const fastifySwaggerUi = require('@fastify/swagger-ui');
const swaggerDocument = require('./swagger.json');
const routes = require('../routes/index.route');
const config = require('./config');
const { initialize } = require('./passport');

// Choose what frontend framework to serve the dist from
let distDir = '../../dist/';
if (config.frontend == 'react') {
  distDir = '../../node_modules/material-dashboard-react/dist';
} else {
  distDir = '../../dist/';
}

console.log(distDir);

// build and configure the Fastify application (equivalent of the former express() app)
function build(opts = {}) {
  const app = Fastify(
    Object.assign(
      {
        // preserve development request logging (parity with morgan('dev'))
        logger: config.env === 'development',
      },
      opts
    )
  );

  // parse application/x-www-form-urlencoded bodies (JSON is parsed natively)
  app.register(fastifyFormbody);

  // cookie parsing
  app.register(fastifyCookie);

  // response compression
  app.register(fastifyCompress);

  // secure apps by setting various HTTP headers
  app.register(fastifyHelmet, { contentSecurityPolicy: false });

  // enable CORS - Cross Origin Resource Sharing
  app.register(fastifyCors);

  // initialize authentication (registers jwt/local verification helpers)
  initialize(app);

  // swagger docs served at /api-docs
  app.register(fastifySwagger, {
    mode: 'static',
    specification: { document: swaggerDocument },
  });
  app.register(fastifySwaggerUi, { routePrefix: '/api-docs' });

  // API router mounted under /api/
  app.register(routes, { prefix: '/api' });

  // serve the built frontend from the dist directory
  app.register(fastifyStatic, {
    root: path.join(__dirname, distDir),
    wildcard: false,
  });

  // customize Joi validation errors and preserve the { message } error shape
  app.setErrorHandler((err, req, reply) => {
    if (err.isJoi) {
      err.message = err.details.map(e => e.message).join('; ');
      err.status = 400;
    }
    const status = err.status || err.statusCode || 500;
    reply.status(status).send({ message: err.message });
  });

  // any non-/api route serves the SPA index.html; unknown /api routes are 404
  app.setNotFoundHandler((req, reply) => {
    if (/api/.test(req.url)) {
      const err = new httpError(404);
      reply.status(err.status).send({ message: err.message });
      return;
    }
    reply.sendFile('index.html', path.join(__dirname, distDir));
  });

  return app;
}

module.exports = build;

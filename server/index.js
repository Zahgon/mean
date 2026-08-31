// config should be imported before importing any other file
const config = require('./config/config');
const build = require('./config/express');
require('./config/mongoose');

const app = build();

// module.parent check is required to support mocha watch
// src: https://github.com/mochajs/mocha/issues/1912
if (!module.parent) {
  app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    console.info(`server started on port ${config.port} (${config.env})`);
  });
}

module.exports = app;

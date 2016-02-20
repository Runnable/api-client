var express = require('express');
var ApiClient = require('../../lib/api-client');

/**
 * Easy to use mock server for api client unit testing. Combines
 * client and server together to reduce setup code in the tests.
 * @param {number} port Custom port for the mock server.
 */
var MockServer = function(port) {
  var self = this;
  this.port = port ? port : this.port;
  this.client = new ApiClient('localhost:' + this.port);
  this.app = express();

  // Expose common express route methods
  var actions = ['get', 'post', 'put', 'delete', 'head'];
  actions.forEach(function(action) {
    self[action] = function() {
      self.app[action].apply(self.app, arguments);
    };
  });
};

/**
 * Default port for the server.
 * @type {Number}
 */
MockServer.prototype.port = 8134;

/**
 * @return {Object} a client for the mock server.
 */
MockServer.prototype.getClient = function() {
  return this.client;
};

/**
 * Starts the server.
 * @param {Function} done Callback to execute once the server has been started.
 */
MockServer.prototype.listen = function(done) {
  this.server = this.app.listen(this.port, done);
};

/**
 * Closes the server.
 */
MockServer.prototype.close = function() {
  if (!this.server) {
    return;
  }
  this.server.close();
};

module.exports = MockServer;

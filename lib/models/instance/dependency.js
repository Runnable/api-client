'use strict';

var util = require('util');
var Base = require('../base');
var exists = require('101/exists');
var defaults = require('101/defaults');
var keypather = require('keypather')();
var url = require('url');
var urlJoin = require('../../url-join');

module.exports = Dependency;

function Dependency () {
  Base.apply(this, arguments);
}

util.inherits(Dependency, Base);

require('../../extend-with-factories')(Dependency, 'instance/dependency');

Dependency.prototype.urlPath = 'dependencies';

Dependency.prototype.idAttribute = 'hostname';

Dependency.prototype.path = function (id) {
  id = id || this.id() || '';
  return urlJoin(this.urlPath, encodeURIComponent(id));
};

Dependency.prototype.update = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  defaults(opts, { put: true });
  Base.prototype.update.call(this, id, opts, cb);
};

/**
 * get full docker url for exposed port
 * @param  {String|Number} exposedPort  exposed port (external port)
 * @return {String}  url - full dockerProtocol:dockerHost:dockerPort, ex: http://10.0.0.1:49021
 */
 Dependency.prototype.dockerUrlForPort = function (exposedPort) {
  if (!exists(exposedPort)) { throw new Error('exposedPort is required'); }
  var dockerHost = keypather.get(this, 'attrs.container.dockerHost');
  var backend = keypather.get(this, 'attrs.container.ports["'+exposedPort+'/tcp"][0]');
  if (!dockerHost || !backend) { return; }
  var parsed = url.parse(dockerHost);
  parsed.port = backend.HostPort;
  delete parsed.host;
  return url.format(parsed);
};


/**
 * Parse the dependency
 * @param attrs
 * @returns attributes
 */
Dependency.prototype.parse = function (attrs) {
  if (attrs.id) {
    this.instance = this.user.newInstance(attrs.id);
  }
  return attrs;
};
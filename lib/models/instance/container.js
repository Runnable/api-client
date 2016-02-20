'use strict';

var util = require('util');
var exists = require('101/exists');
var keypather = require('keypather')();
var Base = require('../base');
var url = require('url');

module.exports = Container;

function Container () {
  Base.apply(this, arguments);
}

util.inherits(Container, Base);

Container.prototype.id = function (id) {
  var idVal = Base.prototype.id.apply(this, arguments);
  if (exists(id)) {
    this.rootDir = this.newDir('/');
  }
  return idVal;
};

Container.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  var id = attrs[this.idAttribute];
  if (!this.id() && exists(id)) {
    this.id(id); // id needs to be set before any factory method is used
  }
  return attrs;
};

Container.prototype.urls = function (hostedDomain) {
  var ports = keypather.get(this, 'attrs.ports');
  var container = this;
  var host;
  if (!hostedDomain) {
    var apiHost = this.client.host;
    var parsed = url.parse(apiHost, false, true);
    host = parsed.hostname;
    // we shouldn't assume the protocol based on what the api is using
    // (could still just want an http connection if we are https)
    if (~host.indexOf('.')) {
      var split = host.split('.');
      split.shift();
      host = split.join('.');
    }
  } else {
    host = hostedDomain;
  }
  var protocol = 'http:';
  if (!ports) {
    return [];
  }
  return Object.keys(ports)
    .map(function (port) {
      return port.split('/').shift();
    })
    .map(function (port) {
      var url = (port === '443' ? 'https:' : protocol) + '//' +
        container.opts.instanceName.toLowerCase() + '-' +
        container.opts.ownerUsername.toLowerCase() +
        '.' + host;
      if (port !== '80' && port !== '443') {
         url += ':' + port;
      }
      return url;
    });
};

Container.prototype.running = function () {
  return keypather.get(this, 'attrs.inspect.State.Running');
};

Container.prototype.idAttribute = 'dockerContainer';

require('../../extend-with-factories')(Container, 'instance/container');

Container.prototype.urlPath = 'containers';

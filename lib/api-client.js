'use strict';

var util = require('util');
var ApiClient = require('simple-api-client');
var findIndex = require('101/find-index');
var isFunction = require('101/is-function');
var isObject = require('101/is-object');
var UnexpectedError = require('./unexpected-error');
var Boom = require('boom');
var isNode = require('./is-node');
var extend = require('extend');
var noop = require('101/noop');

module.exports = Base;

function Base (host, opts) {
  if (isObject(host)) {
    opts = host;
    host = null;
  }
  this.host = host || 'http://api.runnable.com';
  opts = opts || {};
  this.opts = opts;
  // enable cookie jar if serverside
  if (isNode) {
    var requestStr = 'request'; // prevent browserify from bundling request
    var request = require(requestStr);
    if (!opts.jar) {
      opts.jar = request.jar();
    }
  }
  else {
    var defaults = {
      withCredentials: true,
      headers: {
        'Access-Control-Allow-Credentials' : true
      }
    };
    this.opts = extend(defaults, this.opts);
  }
  ApiClient.call(this, this.host, this.opts);
}

util.inherits(Base, ApiClient);

// overwrite methods to handle opts.statusCodes
// Base.prototype.{post, get, put, patch, del, ...}
var Super = ApiClient.prototype;
var nonHttpMethods = ['request', 'xhr'];
Object.keys(ApiClient.prototype).forEach(function (method) {
  if (~nonHttpMethods.indexOf(method)) { return; }
  Base.prototype[method] = function (/* path[, opts][, cb] */) {
    var args = Array.prototype.slice.call(arguments);
    var optsIndex = findIndex(args, isObject);
    var cbIndex = findIndex(args, isFunction);
    var opts;
    // default opts
    if (~optsIndex) {
      opts = args[optsIndex];
    }
    else if (cbIndex === 1) {
      opts = {};
      args.splice(cbIndex, 0, opts);
      cbIndex += 1;
    }
    else {
      opts = {};
      args.push(opts);
    }
    if (!~cbIndex) { // when no cb is supplied
      args.push(noop);
      cbIndex = args.length - 1;
    }
    // attach runnable token
    if (this.opts.token) {
      opts.headers = {
        'runnable-token': this.opts.token
      };
    }
    var key;
    if (~cbIndex) {
      var cb = args[cbIndex];
      args[cbIndex] = this.handleErrors(method, args[0], opts, cb);
      cb = args[cbIndex];
    }
    return Super[method].apply(this, args);
  };
});

Base.prototype.handleErrors = function (method, path, opts, cb) {
  var self = this;
  var statusCodes = opts.statusCodes;
  return function (err, res, body) {
    if (err) {
      cbErr(err);
    }
    else if (statusCodes) {
      var code = res.statusCode;
      if (statusCodes[code] === true) { // success
        cb(err, body, code, res);
      }
      else if (code in statusCodes) {
        var message = statusCodes[code] || body && body.message || body;
        var code304;
        if (code === 304) {
          code304 = code;
          code = 400;
          message = 'Not modified';
          body = {};
        }
        err = Boom.create(code, message, body);
        if (code304) {// hack: boom doesnt see 300+'s as errors
          err.output.statusCode = code304;
        }
        cbErr(err);
      }
      else {
        err = UnexpectedError.create(res, body);
        cbErr(err);
      }
  }
    else {
      cb(null, res, body);
    }
  };
  function cbErr (err) {
    err.data = err.data || {};
    err.data.url = {
      host: self.host,
      method: method,
      path: path
    };
    cb(err);
  }
};

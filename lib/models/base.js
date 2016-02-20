'use strict';
var util = require('util');
var extend = require('extend');
var clone = require('clone');
var keypather = require('keypather')();
var exists = require('101/exists');
var isString = require('101/is-string');
var isFunction = require('101/is-function');
var isObject = require('101/is-object');
var isEmpty = require('101/is-empty');
var assign = require('101/assign');
var urlJoin = require('../url-join');
var intercept = require('../intercept');
var pathJoin = require('../url-join');
var modelStore = require('../stores/model-store');
var EventEmitter = require('../event-emitter');
var defaultMaxRetryCount = 5;
var defaultRetryTimeout = 5;

module.exports = Model;

function Model (attrs, opts) {
  this.opts = opts || {};
  if (this.opts.noStore) {
    this.noStore = this.opts.noStore;
  }
  else {
    if (!this.opts.client) {
      throw new TypeError('model requires a client');
    }
    if (!exists(this.urlPath)) {
      throw new TypeError('model requires a urlPath');
    }
    if (this.opts.parentPath) {
      this.urlPath = pathJoin(this.opts.parentPath, this.urlPath);
    }
  }
  this.attrs = {};
  this._state = {};
  this.client = this.opts.client;
  this.user = this.opts.user;
  this.setMaxListeners(100);
  this.etag = null;
  this.lastModified = null;

  // below must be last
  this.reset(attrs || {});
}

util.inherits(Model, EventEmitter);

Model.prototype.idAttribute = '_id';
Model.prototype.useETags = false;

Model.prototype.id = function (id) {
  if (exists(id)) { //set
    this.attrs[this.idAttribute] = id;
  }
  return this.attrs[this.idAttribute];
};

Model.prototype.path = function (id) {
  id = id || this.id() || '';
  return urlJoin(this.urlPath, id);
};

/**
 * Accept arguments in three forms
 * cb
 * opts, cb
 * id, cb
 */
Model.prototype.formatArgs = function (args) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  var id = args[0];
  var opts = args[1];
  var cb = args[2];
  // cb
  if (isFunction (id)) {
    cb = id;
    id = null;
    opts = null;
  }
  // opts, cb
  if (isObject(id)) {
    cb = opts;
    opts = id;
    id = null;
  }
  // id, cb
  if (isFunction(opts)) {
    cb = opts;
    opts = null;
  }
  id = id || this.id();
  opts = opts || {};
  this.id(id); // sets the id
  return {
    id: id,
    opts: opts,
    cb: cb
  };
};

Model.prototype.extend = function (attrs) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  if (attrs.toJSON) {
    attrs = attrs.toJSON();
  }
  attrs = this.parse(attrs);
  this.attrs = extend(this.attrs, attrs);
  this.emit('update', this, attrs);
};

Model.prototype.reset = function (attrs) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  if (isString(attrs)) {
    var id = attrs;
    this.id(id);
    this.extend({});
    return;
  }
  else if (attrs.toJSON) {
    attrs = attrs.toJSON();
  }
  attrs = clone(attrs, false);
  attrs = this.parse(attrs);
  this.attrs = attrs;
  this.emit('update', this, attrs);
};

Model.prototype.parse = function (attrs) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return attrs;
};

Model.prototype.create = function (opts, cb) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  var self = this;
  if (isFunction(opts)) {
    cb = opts;
    opts = null;
  }
  if (this.id()) {
    return cb(new Error('Cannot call create on an existing '+
      Object.getPrototypeOf(this).constructor.name));
  }
  opts = opts || {};
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  opts.statusCodes = opts.statusCodes || {
    201: true,
    400: false,
    401: false,
    409: false
  };
  var retryCount =  0;
  var maxRetryCount = opts.maxRetryCount || defaultMaxRetryCount;

  return makeRequest();
  function makeRequest () {
    return self.client.post(self.path(), opts, intercept(retryOrErr, function (body, code, res) {
      self.reset(body);
      modelStore.check(self);
      cb(null, body, code, res);
    }));
  }
  function retryOrErr (err) {
    if (opts.retryable &&
        retryCount < maxRetryCount &&
        opts.retryable(err)) {
      retryCount++;
      return makeRequest();
    }
    else {
      self.emit('created:error', self, err);
      cb(err);
    }
  }
};

Model.prototype.fetch = function (id, opts, cb) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.qs || opts.headers ?
    opts : { qs: opts }; // assume opts are qs if no qs key
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    304: true,
    400: false,
    401: false,
    404: false
  };
  var self = this;

  var retryCount =  0;
  var maxRetryCount = opts.maxRetryCount || defaultMaxRetryCount;

  // Add ETag headers when applicable
  if (this.useETags && isString(this.etag)) {
    opts.headers = isObject(opts.headers) ? opts.headers : {};
    opts.headers['If-None-Match'] = this.etag;
  }

  return makeRequest();
  function makeRequest () {
    return self.client.get(self.path(id), opts, intercept(retryOrErr, function (body, code, res) {
      var oldId = self.id();

      if (self.useETags && res.headers.etag) {
        self.etag = res.headers.etag;
      }

      if (res.statusCode != '304') {
        self.reset(body);
        self.lastModified = res.headers['last-modified'];
      }

      if (oldId === 'me' && self.id() !== oldId) { // hack: ensure users/me and user/id are same
        modelStore.check(self);
      }
      if (typeof cb === 'function') {
        cb(null, body, code, res);
      }
    }));
  }
  function retryOrErr (err) {
    if (opts.retryable &&
        retryCount < maxRetryCount &&
        opts.retryable(err)) {
      retryCount++;
      var retryTimeout = opts.retryTimeout || defaultRetryTimeout;
      return setTimeout(makeRequest, retryTimeout);
    }
    else {
      cb(err);
    }
  }
};

Model.prototype.update = function (id, opts, cb) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    400: false,
    401: false,
    404: false,
    409: false
  };
  var self = this;
  var lastAttrs = this.attrs;
  if (opts.put) {
    this.reset(opts.json);
  }
  else {
    this.extend(opts.json);
  }

  var retryCount =  0;
  var maxRetryCount = opts.maxRetryCount || defaultMaxRetryCount;

  return makeRequest();
  function makeRequest () {
    return self.client[opts.put ? 'put' : 'patch'](self.path(id), opts, intercept(retryOrRevert, function (body, code, res) {
      self.reset(body);
      cb(null, body, code, res);
    }));
  }
  function retryOrRevert (err) {
    if (opts.retryable &&
        retryCount < maxRetryCount &&
        opts.retryable(err)) {
      retryCount++;
      var retryTimeout = opts.retryTimeout || defaultRetryTimeout;
      return setTimeout(makeRequest, retryTimeout);
    }
    self.reset(lastAttrs);
    cb(err);
  }
};

Model.prototype.destroy = function (id, opts, cb) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    204: true,
    400: false,
    401: false,
    404: false
  };
  var self = this;
  self.emit('destroy', self);
  return this.client.del(this.path(id), opts, function (err) {
    if (err) {
      self.emit('destroyed:error', self, err);
    }
    else {
      self.dealloc(false);
    }
    cb.apply(null, arguments);
  });
};

/**
 * remove model from cache and collections, and allow to be garbage collected
 */
Model.prototype.dealloc = function (emitDestroy) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  emitDestroy = exists(emitDestroy) ? emitDestroy : true; // default emitDestroy to true
  if (emitDestroy) {
    this.emit('destroy', this);
  }
  this.emit('destroyed', this);
  this.user = {}; // circular
  this.opts = {}; // circular
  this.destroyed = true;
};

Model.prototype.json = function () {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return this.toJSON();
};

Model.prototype.toJSON = function () {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return clone(this.attrs, false);
};

Model.prototype.equals = function (model) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return (this.id() && model.id()) ?
    this.path() === model.path() :
    this === model;
};

/**
 * Reset the working state of the model. This will, in effect clear all
 * unsaved state changes. Optional attributes can be passed clear the state
 * to a given initial value.
 *
 * @param {object} [state] State to set after clear.
 */
Model.prototype.resetState = function(state) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  this._state = exists(state) ? clone(state) : {};
};

/**
 * Saves the current working state into the attributes for the model.
 */
Model.prototype.saveState = function() {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  assign(this.attrs, this._state);
  this.resetState();
};

/**
 * Determines if there are changes in the working state for the model
 * that are not reflected in the attributes.
 *
 * @return {Boolean} True, if there are state changes, false otherwise.
 */
Model.prototype.isDirty = function() {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return !isEmpty(this._state);
};

/**
 * Sets the value for a given key in the objects working state.
 *
 * @param {string} keypath Key path for the item in the state.
 * @param value Value to set.
 */
Model.prototype.setState = function(keypath, value) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  keypather.set(this._state, keypath, value);
};

/**
 * Finds the value of a given keypath in the state. If no value
 * can be found for the given path this will attempt to return
 * the value of the same path in the model's attributes.
 *
 * @param {string} keypath Key path in the state for the value to retrieve.
 * @return The value at the given point in the state if the given
 *   keypath exists, otherwise the value in the attributes for
 *   the same path.
 */
Model.prototype.getState = function(keypath) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return keypather.get(this._state, keypath);
};

/**
 * Determines if there is a given path in the current working state.
 *
 * @param  {string} keypath Key path to check.
 * @return {Boolean} True if there is a value for the given path, false otherwise.
 */
Model.prototype.hasState = function(keypath) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  return keypather.in(this._state, keypath);
};

/**
 * Determines if the origin for the model has changes that are not accounted for
 * in the model's current set of attributes. This is useful, for instance, to
 * see if the resource has been changed at the origin since the last fetch.
 *
 * @param id Id of the model to check againsts.
 * @param {Object} opts Options for the request.
 * @param {responseCallback} cb Handles response.
 */

/**
 * Handles the response from the remote changes check.
 * @callback responseCallback
 * @param err Error response, if applicable.
 * @param {Boolean} hasChanges True if there are changes at the origin since the
 *   last fetch, false otherwise.
 * @return {Boolean}
 */
Model.prototype.hasRemoteChanges = function(id, opts, cb) {
  if (this.destroyed) { return console.trace('this model is destroyed, don\'t use it anymore!'); }
  if (!exists(this.lastModified)) {
    return console.trace('Cannot check for remote changes on a model that has not been fetched.');
  }

  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ? opts : {};
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    204: true,
    400: false,
    401: false,
    404: false
  };
  var self = this;

  this.client.head(this.path(id), opts, function(err, body, code, res) {
    if (err) { cb(err); }
    cb(null, res.headers['last-modified'] != self.lastModified);
  });
};

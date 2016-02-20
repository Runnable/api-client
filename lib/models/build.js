'use strict';

var path = require('path');
var util = require('util');
var isString = require('101/is-string');
var exists = require('101/exists');
var Base = require('./base');
var intercept = require('../intercept');
var modelStore = require('../stores/model-store');
var isBrowser = typeof window !== 'undefined' || process.env.NODE_ENV === 'browser';

module.exports = Build;

function Build () {
  Base.apply(this, arguments);
}

util.inherits(Build, Base);

require('../extend-with-factories')(Build);

Build.prototype.urlPath = 'builds';

Build.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  this.setupChildren(attrs);
  return attrs;
};

Build.prototype.setupChildren = function (attrs) {
  var id = attrs[this.idAttribute];
  if (!this.id() && exists(id)) {
    this.id(id); // id needs to be set before any factory method is used
  }
  if (attrs.contexts) {
    // note: avoid creating noStore-collections repeatedly or event emitters will leak
    if (!this.contexts) {
      this.contexts = this.user.newContexts(attrs.contexts, { noStore:true });
    }
    else {
      this.contexts.reset(attrs.contexts);
    }
  }
  if (attrs.contextVersions && attrs.contextVersions.length) {
    // note: avoid creating noStore-collections repeatedly or event emitters will leak
    if (!this.contextVersions) {
      // note: build context and contextVersion will always have a length of 1
      // todo: change this just to be two subModels instead of collections.
      this.contextVersions =
        this.contexts.models[0].newVersions(attrs.contextVersions, { noStore: true });
    }
    else {
      this.contextVersions.reset(attrs.contextVersions);
    }
  }
};

Build.prototype.copy = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    201: true,
    401: false,
    404: false,
    409: false
  };
  var copiedBuild = this.user.newBuild({}, { warn: false });
  var copyPath = path.join(this.path(id), 'actions', 'copy');
  this.client.post(copyPath, opts, function (err, data) {
    if (!err) {
      copiedBuild.reset(data);
      modelStore.check(copiedBuild);
    }
    cb.apply(null, arguments);
  });
  return copiedBuild;
};

Build.prototype.deepCopy = function (cb) {
  var qs = {
    deep: true
  };
  return this.copy({ qs: qs }, cb);
};

Build.prototype.build = function (id, opts, cb) {
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
    201: true,
    400: false,
    401: false,
    404: false,
    409: false
  };
  var buildPath = path.join(this.path(id), '/actions/build');
  var build = this;
  return this.client.post(buildPath, opts, intercept(cb, function (body, code) {
    build.extend(body);
    modelStore.check(build);
    // FIXME: Breaking api tests bc of missing mocks bc model-store is not enabled...
    if (!isBrowser) { return cb(null, body, code); }
    var cvs = build.contextVersions.models || [];
    if (cvs.length) {
      cvs[0].fetch(cb);
    } else {
      cb(null, body, code);
    }
  }));
};

Build.prototype.rebuild = function (id, opts, cb) {
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
    201: true,
    400: false,
    401: false,
    404: false,
    409: false
  };
  var buildPath = path.join(this.path(id), '/actions/rebuild');
  var newBuild = new Build({}, this.opts);
  this.client.post(buildPath, opts, intercept(cb, function (newBuildData, code) {
    newBuild.extend(newBuildData);
    //this is a brand new model so we are just using check to store it
    modelStore.check(newBuild);
    cb(null, newBuildData, code);
  }));
  return newBuild;
};

Build.prototype.buildTime = function() {
  return Date.parse(this.attrs.completed) - Date.parse(this.attrs.started);
};

Build.prototype.failed = function () {
  return this.attrs.completed && this.attrs.failed;
};

Build.prototype.fork = function (env, cb) {
  var build = this;
  if (typeof env === 'function') {
    cb = env;
    env = null;
  }
  env = env || build.attrs.environment;
  return build.user.createBuild({
    parentBuild: build.id()
  }, cb);
};

Build.prototype.succeeded = function () {
  return this.attrs.completed && !this.attrs.failed;
};

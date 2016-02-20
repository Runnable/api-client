'use strict';

var path = require('path');
var util = require('util');
var isString = require('101/is-string');
var find = require('101/find');
var Base = require('../base');
var exists = require('101/exists');
var modelStore = require('../../stores/model-store');
var collectionStore = require('../../stores/collection-store');

module.exports = Version;

function Version () {
  Base.apply(this, arguments);
}

util.inherits(Version, Base);

require('../../extend-with-factories')(Version, 'context/version');

Version.prototype.urlPath = 'versions';

Version.prototype.id = function (id) {
  var idVal = Base.prototype.id.apply(this, arguments);
  if (exists(id)) {
    this.rootDir = this.newDir('/');
  }
  return idVal;
};

Version.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  this.setupChildren(attrs);
  return attrs;
};

Version.prototype.setupChildren = function (attrs) {
  var id = attrs[this.idAttribute];
  if (!this.id() && exists(id)) {
    this.id(id); // id needs to be set before any factory method is used
  }
  if (attrs.appCodeVersions) {
    this.appCodeVersions = this.newAppCodeVersions(attrs.appCodeVersions, { qs: {} });
  }
  else if (!this.appCodeVersions) {
    // user.newContext(id).newVersion(id).appCodeVersions should exist
    this.appCodeVersions = this.newAppCodeVersions([], { qs: {}, reset: false });
  }
};

Version.prototype.rollback = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  if (!opts.lastBuiltSimpleContextVersion) {
    return cb(new Error('Cannot rollback to a non existant version'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    404: false,
    409: false
  };
  var contextId = this.attrs.context || this.path().split('/')[1];
  var rollbackedVersion = this.user
    .newContext(contextId)
    .newVersion({_id: opts.lastBuiltSimpleContextVersion.id}, { warn: false });

  rollbackedVersion.fetch(function (err, data) {
    if (!err && data) {
      rollbackedVersion.reset(data);
      modelStore.check(rollbackedVersion);
    } else {
      rollbackedVersion.dealloc();
    }
    cb.apply(null, arguments);
  });
  return rollbackedVersion;
};

Version.prototype.copy = function (id, opts, cb) {
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
  var contextId = this.attrs.context || this.path().split('/')[1];
  var copiedVersion = this.user
    .newContext(contextId)
    .newVersion({}, { warn: false });
  var copyPath = path.join(this.path(id), 'actions', 'copy');
  this.client.post(copyPath, opts, function (err, data) {
    if (!err) {
      copiedVersion.reset(data);
      modelStore.check(copiedVersion);
    }
    cb.apply(null, arguments);
  });
  return copiedVersion;
};

Version.prototype.deepCopy = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts.body || args.opts.qs || args.opts.headers ?
    args.opts :
    { json: args.opts }; // default opts to body if opts don't look like opts
  cb = args.cb;
  opts.qs = { deep: true };
  return this.copy(id, opts, cb);
};

// opts.repo, opts.branch, opts.commit
Version.prototype.addGithubRepo = function (repo, cb) {
  var json = isString(repo) ? {repo: repo} : repo;
  return this.appCodeVersions.create(json, cb);
};

Version.prototype.removeGithubRepo = function (id, cb) {
  return this.deleteAppCodeVersion(id, cb);
};

Version.prototype.getMainAppCodeVersion = function () {
  return find(this.appCodeVersions.models, function (appCodeVersion) {
    return !appCodeVersion.attrs.additionalRepo;
  });
};

Version.prototype.copyFilesFromSource = function (sourceInfraCodeVersionId, cb) {
  if (typeof sourceInfraCodeVersionId === 'function') {
    throw new Error('sourceInfraCodeVersionId is required');
  }
  var opts = {};
  opts.qs = {
    sourceInfraCodeVersion: sourceInfraCodeVersionId
  };
  opts.statusCodes = opts.statusCodes || {
    200: true,
    400: false,
    401: false,
    404: false,
    409: false
  };
  var copyActionPath = path.join(this.path(), '/infraCodeVersion/actions/copy');
  // assume success, invalidate cache
  var fsList = this.newFsList([], {
    qs: {
      path: '/'
    }
  });
  collectionStore.remove(fsList);
  return this.client.put(copyActionPath, opts, function (err) {
    if (err) {
      // restore cache
      collectionStore.add(fsList);
    }
    cb.apply(this, arguments);
  });
};

Version.prototype.discardFileChanges = function (cb) {
  var opts = {};
  opts.statusCodes = opts.statusCodes || {
    204: true,
    401: false,
    404: false
  };
  var discardActionPath = path.join(this.path(), '/actions/discardFileChanges');
  return this.client.post(discardActionPath, opts, cb);
};

Version.prototype.build = function (id, opts, cb) {
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
  // since it *can* be a new build, we need this logic (similar to deep copy)
  var builtVersion = this.user
    .newContext(this.attrs.context)
    .newVersion({}, { warn: false });
  var buildPath = path.join(this.path(id), '/actions/build');
  this.client.post(buildPath, opts, function (err, data) {
    if (!err) {
      builtVersion.reset(data);
      modelStore.check(builtVersion);
    }
    cb.apply(null, arguments);
  });
  return builtVersion;
};

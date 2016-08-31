/**
 * @module lib/models/instance
 */
'use strict';

var Boom = require('boom');
var equals = require('deep-equal');
var exists = require('101/exists');
var extend = require('extend');
var find = require('101/find');
var hasKeypaths = require('101/has-keypaths');
var isObject = require('101/is-object');
var isString = require('101/is-string');
var keypather = require('keypather')();
var path = require('path');
var Promise = require('bluebird');
var runnableHostname = require('@runnable/hostname');
var url = require('url');
var util = require('util');
var uuid = require('uuid');

var Base = require('./base');
var collectionStore = require('../stores/collection-store');
var intercept = require('../intercept');
var modelStore = require('../stores/model-store');

var toHostname = function (env) {
  if (!env || !~env.indexOf('://')) {
    env = ~env.indexOf('//') ?
      env.replace('//', 'http://') :
      'http://'+env;
  }
  return url.parse(env, true).hostname;
};
var endsWith = function (endStr) {
  return function (str) {
    var regExp = new RegExp(endStr+'$');
    return (str && regExp.test(str));
  };
};

var startingState = {
  Starting: true
};

var stoppingState = {
  Stopping: true
};

module.exports = Instance;

function Instance () {
  // bind methods used as event handlers
  // listen for room change events
  // this is used to detach handlers of models where the owner
  //   does not match socket room
  //  MUST BE ABOVE SUPER
  this.handleSocketData = this.handleSocketData.bind(this);
  this.handleJoinRoom   = this.handleJoinRoom.bind(this);
  // super constructor
  Base.apply(this, arguments);
  if (this.user.socket) {
    this.user.socket.onJoinRoom(this.handleJoinRoom);
  }
}

function retryable (err) {
  var payload = keypather.get(err, 'output.payload') || {};
  var retry = payload.statusCode === 409 &&
    (/try again/).test(payload.message);
  return retry;
}

/**
 * validate container existence
 * @param  {Object} container instance.attrs.container - instance container json
 * @return {Error}  err       returns err only if container does not exist, else null
 */
function validateContainer (container) {
  if (!container) {
    return Boom.create(504, 'instance has no container');
  }
  if (container.error) {
    return Boom.create(504, 'instance container has error', container.error);
  }
  if (container.inspect.error) {
    return Boom.create(503, 'instance inspect failed (try again)', container.inspect.error);
  }
  return null;
}

util.inherits(Instance, Base);

require('../extend-with-factories')(Instance);

Instance.prototype.urlPath = 'instances';

Instance.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  this.setupChildren(attrs);
  this.updateSocketEvents(attrs);
  this.backgroundContextVersionBuilding = false;
  this.backgroundContextVersionFinished = false;
  this.configStatusPromise = null;
  return attrs;
};

/**
 * update attach or detach event handlers from the socket based
 *   of if the model's owner matches the current socket room
 * @param  {Object} attrs current or incoming attrs of the model
 */
Instance.prototype.updateSocketEvents = function (attrs) {
  var ownerId = keypather.get(attrs, 'owner.github');
  if (!this.user.socket || this.opts.noStore || !this.user.socket.orgRoom || !ownerId) { return; }

  if (ownerId === this.user.socket.orgRoom) {
    this.listenToSocketEvents(attrs);
  }
  else {
    // newOwnerId is not current roomId
    this.stopListeningToSocketEvents();
  }
};

/**
 * Sets the array of instances given to the children array on this model.  It also sets the
 * masterPodInstance on each child instance to this
 * @param children {[Instance]} non-masterPod children of this masterPod
 */
Instance.prototype.setChildren = function (children) {
  if (this.attrs.masterPod) {
    var self = this;
    this.children.reset(children);
    children.forEach(function (childInstance) {
      childInstance.masterPodInstance = self;
    })
  }
};

/**
 * listen to socket room data events (model's owner matches the socket room)
 */
Instance.prototype.listenToSocketEvents = function () {
  if (this.listening) { return; }
  this.listening = true;
  this.user.socket.on('data', this.handleSocketData);
};

/**
 * handle socket room event data, if the data is an update
 *   event for the current model, update this model with the data
 * @param  {Object} data [description]
 * @return {[type]}      [description]
 */
Instance.prototype.handleSocketData = function (data) {
  /*jshint maxcomplexity:12 */
  var event = keypather.get(data, 'data.event');
  if (event !== 'INSTANCE_UPDATE' && event !== 'CONTEXTVERSION_UPDATE') { return; }
  var action = keypather.get(data, 'data.action');
  var newData = keypather.get(data, 'data.data');
  if (event === 'INSTANCE_UPDATE') {
    var updateEvents = [
      'container_inspect',
      'deploy',
      'patch',
      'redeploy',
      'restart',
      'start',
      'starting',
      'stop',
      'stopping',
      'update'
    ];
    var idAttribute = Instance.prototype.idAttribute;
    if (newData && newData[idAttribute] === this.id()) {
      if (~updateEvents.indexOf(action)) {
        if (!keypather.get(newData, 'owner.username')) {
          var errorMessage =
            'Instance updated without owner.username. data.event: ' + event +
            ' data.action:' + action + ' instanceId:' + newData[idAttribute] +
            ' ownerObj: ' + JSON.stringify(newData.owner);
          var error = new Error(errorMessage);
          // Throw inside a timeout because we still want to process...
          // but we need this error to go to rollbar.
          setTimeout(function () {
            throw error;
          });
        }
        this.reset(newData);
        if (this.children) {
          this.children.forEach(function (instance) {
            instance.configStatusPromise = null;
          });
        }
        modelStore.emit('model:update:socket');
      }
      else if (action === 'delete') {
        this.dealloc();
        collectionStore.emit('collection:update:socket');
      }
    }
  } else if (newData.context &&
      keypather.get(this, 'contextVersion.attrs.context') === newData.context) {
    // Assuming it's CV_Update, because of the check near the beginning

    // If the contexts match, we're close to finding the match
    // Since master-children all share contexts, we need to find the
    var mainAcv = this.contextVersion.getMainAppCodeVersion();
    if (mainAcv && find(newData.appCodeVersions, function (appCodeVersion) {
      return appCodeVersion.lowerBranch === mainAcv.attrs.lowerBranch;
    })) {
      if (action === 'build_started') {
        this.backgroundContextVersionBuilding = newData.build;
        this.backgroundContextVersionFinished = false;
        modelStore.emit('model:update:socket');
      } else if (action === 'build_completed') {
        this.backgroundContextVersionBuilding = false;
        this.backgroundContextVersionFinished = newData.build;
        modelStore.emit('model:update:socket');
      }
    }
  }
};

/**
 * stop listening to socket events (model's owner does not match the socket room)
 * @return {[type]} [description]
 */
Instance.prototype.stopListeningToSocketEvents = function () {
  if (!this.listening) {
    return;
  }
  this.listening = false;
  this.user.socket.off('data', this.handleSocketData);
};

/**
 * handle a socket room change (user may exit one org's room and enter another)
 */
Instance.prototype.handleJoinRoom = function () {
  this.updateSocketEvents(this.attrs);
};

Instance.prototype.fetchMasterPod = function (cb) {
  if (!this.attrs.masterPod && this.contextVersion) {
    return this.user.fetchInstances({
      'contextVersion.context': this.contextVersion.attrs.context,
      masterPod: true,
      githubUsername: this.attrs.owner.username
    }, cb);
  } else {
    return cb();
  }
};

/**
 * A cached promise that tells whether this instance and its MasterPodInstance don't match.  This
 * promise is cleared when either this instance is parsed, or its parent is parsed
 *
 * @returns {Promise}  resolves when we determine if the masterPod and this instance match
 * @resolves {Boolean} Whether this instance matches its masterPod
 */
Instance.prototype.doesMatchMasterPod = function () {
  var self = this;
  if (!this.configStatusPromise) {
    this.configStatusPromise = Promise.try(function () {
      if (self.attrs.masterPod || !self.masterPodInstance) {
        // if this is the masterpod, or there are no master instances, then return true;
        return true;
      }
      var masterTransformRules = keypather.get(
        self.masterPodInstance,
        'contextVersion.getMainAppCodeVersion().attrs.transformRules'
      );
      var myTransformRules = keypather.get(
        self,
        'contextVersion.getMainAppCodeVersion().attrs.transformRules'
      );
      // Check to make sure the envs are equal, and the transformRules
      if (!equals(self.masterPodInstance.attrs.env, self.attrs.env) ||
          !equals(masterTransformRules, myTransformRules)) {
        return false;
      }

      var masterContents = self.masterPodInstance.contextVersion.rootDir.contents;
      var myContents = self.contextVersion.rootDir.contents;

      var props = {};
      if (!masterContents.models.length) {
        props.masterContents = Promise.fromCallback(masterContents.fetch.bind(masterContents));
      }
      if (!myContents.models.length) {
        props.myContents = Promise.fromCallback(myContents.fetch.bind(myContents))
      }
      return Promise.props(props)
        .then(function () {
          // if the amount of build files are different, then we know it's out of sync
          if (masterContents.models.length !== myContents.models.length) {
            return false;
          }
          return masterContents.models.every(function (masterFile) {
            return find(myContents.models, hasKeypaths({ 'attrs.hash': masterFile.attrs.hash }));
          });
        });
    });
  }
  return this.configStatusPromise;
};
/**
 * This will link directly to a specific instance.
 * There will be no server picker to get to this instance.
 */
Instance.prototype.getContainerHostname = function () {
  var userContentDomain = this.opts.user.opts.userContentDomain;
  var githubUsername = keypather.get(this, 'attrs.owner.username');
  // If it's a master pod we need to build the URL using the branch name
  // Otherwise we need to use attrs.name
  var instanceName = this.attrs.name;
  var branchName = this.getBranchName();
  var opts = {
    shortHash: this.attrs.shortHash,
    instanceName: instanceName,
    branch: branchName,
    ownerUsername: githubUsername,
    masterPod: this.attrs.masterPod,
    userContentDomain: userContentDomain,
    isolated: this.attrs.isolated,
    isIsolationGroupMaster: this.attrs.isIsolationGroupMaster
  };
  // NON-REPO CONTAINERS CAN HAVE DIRECT URLS
  return (this.attrs.masterPod && !branchName) ?
    runnableHostname.elastic(opts): // masterPods w/out branch don't have direct urls
    runnableHostname.direct(opts);
};

/**
 * Elastic Hostname is the url that will pop up the server
 * picker if the user hits it without a cookie.
 */
Instance.prototype.getElasticHostname = function () {
  var userContentDomain = this.opts.user.opts.userContentDomain;
  var githubUsername = keypather.get(this, 'attrs.owner.username');
  var instanceName = this.attrs.name;
  var branchName = this.getBranchName();

  //return (repoName + '-staging-' + githubUsername + '.' + userContentDomain).toLowerCase();
  return runnableHostname.elastic({
    shortHash: this.attrs.shortHash,
    instanceName: instanceName,
    branch: branchName,
    ownerUsername: githubUsername,
    masterPod: this.attrs.masterPod,
    userContentDomain: userContentDomain,
    isolated: this.attrs.isolated,
    isIsolationGroupMaster: this.attrs.isIsolationGroupMaster
  });
};

/**
 * Get name for current branch
 * @return {String}
 */
Instance.prototype.getBranchName = function () {
  return keypather.get(this.contextVersion, 'getMainAppCodeVersion().attrs.branch');
};

/**
 * Get name for current repository
 * @return {String}
 */
Instance.prototype.getRepoName = function () {
  var repo = keypather.get(this.contextVersion, 'getMainAppCodeVersion().attrs.repo');
  if (repo) {
    return repo.split('/')[1];
  }
};

/**
 * Get `repo/branch` style string for instance
 *
 * Don't use this method to get the full name for an instance. Instead, use
 * `getInstanceAndBranchName` which handles multiple instances with
 * the same repo.
 *
 * @return {String}
 */
Instance.prototype.getRepoAndBranchName = function () {
  var repoName = this.getRepoName();
  var branchName = this.getBranchName();
  if (repoName && branchName) {
    return repoName + '/' + branchName;
  }
  return this.getName();
};

/**
 * Get `name/branch` style string for instance
 *
 * @return {String}
 */
Instance.prototype.getInstanceAndBranchName = function () {
  var instanceName = this.getName();
  var branchName = this.getBranchName();
  if (instanceName && branchName) {
    return instanceName + '/' + branchName;
  }
  return instanceName;
};

/**
 * Get left-nav display name for container.
 *
 * This is how instances are displayed in left nav of runnable-angular and should
 * NOT be used for anything other than this despite it's attractive looking name
 *
 * @return {String}
 */
Instance.prototype.getDisplayName = function () {
  var branchName = this.getBranchName();
  if (!this.attrs.masterPod && branchName) {
    return branchName;
  }
  return this.getName();
};

/**
 * Get name for instance. Handles isolated containers.
 *
 * @return {String}
 */
Instance.prototype.getName = function () {
  if (/^[A-z0-9]{6}--/.test(this.attrs.name)) { // ShHash--Real-name
    return this.attrs.name.split('--')[1];
  }
  return this.attrs.name;
};

/**
 * Get original name given to the instance when created (usually repo name)
 *
 * @return {String}
 */
Instance.prototype.getMasterPodName = function () {
  return this.getName().replace(this.getBranchName() + '-', '');
};

Instance.prototype.setupChildren = function (attrs) {
  /*jshint maxcomplexity:12 */
  var id = attrs[this.idAttribute];
  if (!this.id() && exists(id)) {
    this.id(id); // id needs to be set before any factory method is used
  }
  //This is a hack to preserve the temporary instance "starting" or "stopping" states
  //if the instance is placed in that state w/ optimistic success assumption and a refetch occurs
  var containerInspectState = keypather.get(attrs.containers, '[0].inspect.State');
  if (this.stoppingInFlight && isObject(containerInspectState)) {
    extend(containerInspectState, stoppingState);
  }
  if (this.startingInFlight && isObject(containerInspectState)) {
    extend(containerInspectState, startingState);
  }
  if (attrs.containers) {
    attrs.containers = attrs.containers.map(function (container) {
      // container error don't have the container idAttribute
      // so they throw warnings when they are added to the
      // containers collection
      if (container.error && !container.dockerContainer) {
        container.dockerContainer = uuid();
      }
      return container;
    });
    this.containers = this.newContainers(attrs.containers, {
      qs: {},
      instanceName: attrs.name,
      ownerUsername: attrs.owner.username,
      warn: false  // some containers are just container errors with no dockerContainer as id
    });
  }
  if (attrs.env) {
    this.genDeps(attrs);
  }
  if (keypather.get(attrs, 'contextVersion.context') && attrs.masterPod) {
    var qs = {
      masterPod: false,
      'contextVersion.context': attrs.contextVersion.context,
      githubUsername: attrs.owner.username
    };
    this.children = this.user.newInstances([], {
      qs: qs,
      reset: false
    });
  }
  var nameUpdated = attrs.name && attrs.name !== this.attrs.name;
  var containersInstanceNameNeedsUpdate = !attrs.containers && this.containers;
  if (nameUpdated && containersInstanceNameNeedsUpdate) {
    this.containers.forEach(function(container) {
      container.opts.instanceName = attrs.name;
    });
  }
  if (attrs.build) {
    this.build = this.user.newBuild(attrs.build);
  }
  if (attrs.isolated) {
    this.isolation = this.user.newIsolation({
      _id: attrs.isolated,
      ownerUsername: keypather.get(attrs, 'owner.username')
    });
    if (attrs.isIsolationGroupMaster) {
      this.isolation.groupMaster = this;
    }
  }
  if (attrs.contextVersion) {
    var cv = attrs.contextVersion;
    this.contextVersion = this.user.newContext(cv.context).newVersion(cv);
  }
};

/**
 * generate dependencies collection from incoming attrs
 * @param {Object} attrs incoming attrs
 */
Instance.prototype.genDeps = function (attrs) {
  var self = this;
  var userContentDomain = this.user.opts.userContentDomain;
  var env = attrs.env;
  var githubUsername = keypather.get(attrs, 'owner.username') ||
    keypather.get(this, 'attrs.owner.username');
  var opts = {
    qs: {
      githubUsername: githubUsername
    },
    reset: false
  };
  var instancesByOwner = this.user.newInstances([], opts).models;
  var depModels = env
    .map(function (env) {
      return toHostname(env.split('=').pop()); // map to env value
    })
    .filter(endsWith(userContentDomain))
    .map(function (envHostname) {
      return find(instancesByOwner, function (instance) {
        var instanceHostname = instance.attrs.name + '-' + githubUsername + '.' + userContentDomain;
        return instanceHostname === envHostname && instance !== self;
      });
    })
    .filter(exists);
  // note: avoid creating noStore-collections repeatedly or event emitters will leak
  if (!this.dependencies) {
    this.dependencies = this.user.newInstances(depModels, {
      noStore: true
    });
  }
  else {
    this.dependencies.reset(depModels);
  }
};

Instance.prototype.isInMasterPod = function (cb) {
  var masterPod = this.attrs.masterPod === true;
  if (cb) { cb(null, masterPod); }
  else { return masterPod; }
};

Instance.prototype.setInMasterPod = function (id, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  var opts = { json: [true] };
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    204: true,
    304: false,
    401: false,
    404: false,
    409: false
  };
  var self = this;
  // optimistic set
  var prevMasterPod = this.attrs.masterPod;
  this.attrs.masterPod = true;
  var masterPodPath = path.join(this.path(id), 'masterPod');
  return this.client.put(masterPodPath, opts, function (err, body, code, res) {
    if (err) {
      // revert
      self.attrs.masterPod = prevMasterPod;
      return cb(err);
    }
    cb(null, body, code, res);
  });
};

Instance.prototype.removeFromMasterPod = function (id, opts, cb) {
  /*jshint maxcomplexity:9 */
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    204: true,
    304: false,
    401: false,
    404: false,
    409: false
  };
  var self = this;
  var masterPodPath = path.join(this.path(id), 'masterPod');
  return this.client.delete(masterPodPath, opts, function (err, body, code, res) {
    if (err) { return cb(err); }
    self.attrs.masterPod = false;
    cb(null, body, code, res);
  });
};

Instance.prototype.start = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    304: false,
    401: false,
    404: false,
    409: false
  };
  var startPatch = path.join(this.path(id), 'actions', 'start');
  var self = this;
  // assume success
  var containerAttrs = keypather.get(this, 'containers.models[0].attrs');
  delete this.stoppingInFlight;
  this.startingInFlight = true;
  if (containerAttrs && keypather.in(containerAttrs, 'inspect.State')) {
    extend(containerAttrs.inspect.State, startingState);
  }
  return this.client.put(startPatch, opts, intercept(revert, function (body, code, res) {
    delete self.startingInFlight;
    self.reset(body);
    cb(null, body, code, res);
  }));
  function revert (err) {
    delete self.startingInFlight;
    // if the container.dockerContainer previously existed - then it should've had inspect.State
    if (containerAttrs && keypather.in(containerAttrs, 'inspect.State')) {
      Object.keys(startingState).forEach(function (key) {
        delete containerAttrs.inspect.State[key];
      });
    }
    cb(err);
  }
};

Instance.prototype.restart = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    304: false,
    401: false,
    404: false,
    409: false
  };
  var restartPath = path.join(this.path(id), 'actions', 'restart');
  var self = this;
  return this.client.put(restartPath, opts, function (err, body, code, res) {
    if (err) { return cb(err); }
    self.reset(body);
    cb(null, body, code, res);
  });
};

Instance.prototype.stop = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    304: false,
    401: false,
    404: false,
    409: false
  };
  var stopPath = path.join(this.path(id), 'actions', 'stop');
  var self = this;
  // assume success
  var containerAttrs = keypather.get(this, 'containers.models[0].attrs');
  delete this.startingInFlight;
  this.stoppingInFlight = true;
  if (containerAttrs && keypather.in(containerAttrs, 'inspect.State')) {
    extend(containerAttrs.inspect.State, stoppingState);
  }
  return this.client.put(stopPath, opts, intercept(revert, function (body, code, res) {
    delete self.stoppingInFlight;
    self.reset(body);
    cb(null, body, code, res);
  }));
  function revert (err) {
    delete self.stoppingInFlight;
    // if the container.dockerContainer previously existed - then it should've had inspect.State
    if (containerAttrs && keypather.in(containerAttrs, 'inspect.State')) {
      Object.keys(stoppingState).forEach(function (key) {
        delete containerAttrs.inspect.State[key];
      });
    }
    cb(err);
  }
};

Instance.prototype.buildUrl = function () {
  var attrs = this.attrs;
  var hasRequiredAttrs = attrs.owner &&
    isObject(attrs.build);
  if (hasRequiredAttrs) {
    this._buildUrl = this._buildUrl || path.join(
      attrs.owner.username+'',
      attrs.build.buildNumber+''
    );
    return this._buildUrl;
  }
};

Instance.prototype.regraph = function (id, opts, cb) {
  var self = this;
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  var regraphPath = path.join(this.path(id), 'actions', 'regraph');
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    404: false,
    409: false
  };
  return this.client.post(regraphPath, opts, function(err, data) {
    if (!err) {
      self.reset(data);
    }
    cb.apply(null, arguments);
  });
};

Instance.prototype.deploy = function (id, opts, cb) {
  var self = this;
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  var deployPath = path.join(this.path(id), 'actions', 'deploy');
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    404: false,
    409: false
  };
  opts.retryable = opts.retryable || retryable;
  opts.maxRetryCount = 15;
  opts.retryTimeout  = 100;
  return this.client.post(deployPath, opts, function(err, data) {
    if (!err) {
      self.reset(data);
    }
    cb.apply(null, arguments);
  });
};

Instance.prototype.redeploy = function (id, opts, cb) {
  var self = this;
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  var deployPath = path.join(this.path(id), 'actions', 'redeploy');
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    404: false,
    409: false
  };
  opts.retryable = opts.retryable || retryable;
  opts.maxRetryCount = 15;
  opts.retryTimeout  = 100;
  return this.client.post(deployPath, opts, function(err, data) {
    if (!err) {
      self.reset(data);
    }
    cb.apply(null, arguments);
  });
};

Instance.prototype.copy = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  var deployPath = path.join(this.path(id), 'actions', 'copy');
  opts.statusCodes = opts.statusCodes || {
    201: true,
    401: false,
    404: false,
    409: false
  };
  var forkedInstance = this.user.newInstance({}, { warn: false });
  this.client.post(deployPath, opts, function (err, data) {
    if (!err) {
      forkedInstance.reset(data);
      modelStore.check(forkedInstance);
    }
    cb.apply(null, arguments);
  });
  return forkedInstance;
};

Instance.prototype.deployed = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  var containersPath = path.join(this.path(id), 'containers');
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    403: false,
    404: false
  };
  this.client.get(containersPath, opts, function (err, containers) {
    var deployed = Boolean(containers && containers.length);
    cb(err, deployed);
  });
};

Instance.prototype.hasNewBuild = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  cb = args.cb;
  var buildPath = path.join(this.path(id), 'build');
  opts.statusCodes = opts.statusCodes || {
    200: true,
    401: false,
    403: false,
    404: false
  };
  var self = this;
  this.client.get(buildPath, opts, function (err, buildId) {
    if (err) { return cb(err); }
    var modelBuildId = keypather.get(self, 'attrs.build._id');
    if (!modelBuildId) {
      cb(null, false); // we don't have any buildId to compare it to.
    }
    else {
      cb(err, modelBuildId !== buildId);
    }
  });
};

Instance.prototype.shortBuildUrl = function () {
  var attrs = this.attrs;
  var hasRequiredAttrs = isObject(attrs.environment) &&
    isObject(attrs.build);

  if (hasRequiredAttrs) {
    this._shortBuildUrl = this._shortBuildUrl || path.join(
      attrs.build.buildNumber+''
    );
    return this._shortBuildUrl;
  }
};

/**
 * get full docker url for exposed port
 * @param  {String|Number} exposedPort  exposed port (external port)
 * @return {String}  url - full dockerProtocol:dockerHost:dockerPort, ex: http://10.0.0.1:49021
 */
Instance.prototype.dockerUrlForPort = function (exposedPort) {
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
 * Valid arguments
 * cb
 * opts, cb
 * id, cb
 */
Instance.prototype.update = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  opts.retryable = opts.retryable || retryable;
  opts.maxRetryCount = 15;
  opts.retryTimeout  = 100;
  Base.prototype.update.call(this, id, opts, cb);
};

Instance.prototype.dealloc = function () {
  this.stopListeningToSocketEvents(); // must be called before super dealloc
  Base.prototype.dealloc.call(this);
};

/**
 * gets the backend url of an instance and verifies the port is exposed
 * @param  {Function}  cb        callback
 */
Instance.prototype.getContainerUrl = function (urlPort, cb) {
  var err = validateContainer(this.attrs.container);
  if (err) { return cb(err); }

  var containerUrl = this.dockerUrlForPort(urlPort);
  if (!containerUrl) {
    return cb(Boom.create(400, 'port not exposed', urlPort));
  }

  cb(null, containerUrl);
};

/**
 * Status of instance
 * @return {enum}
 *   - stopped
 *   - crashed
 *   - running
 *   - buildFailed
 *   - building
 *   - neverStarted
 *   - unknown
 */
Instance.prototype.status = function () {
  /*jshint maxcomplexity:9 */
  var jesusBirthday = '0001-01-01T00:00:00Z';
  var container = keypather.get(this, 'containers.models[0]');
  var build = keypather.get(this, 'contextVersion.attrs.build');
  if (container) {
    // Starting/Stopping are not docker API response properties, custom inserted by API
    if (keypather.get(container, 'attrs.inspect.State.Starting')) {
      return 'starting';
    }
    if (keypather.get(container, 'attrs.inspect.State.Stopping')) {
      return 'stopping';
    }
    if (container.running()) {
      return 'running';
    }
    // If we have a container, but it's not running and we have no record of when
    // it was started, this means we have yet to trigger the start on the API side of things
    // so for now, the container is in a weird, never started state.
    if (keypather.get(container, 'attrs.inspect.State.StartedAt') === jesusBirthday) {
      return 'neverStarted';
    }
    // The container is not running, and it's exit code is 0, meaning it's stopped properly
    if (keypather.get(container, 'attrs.inspect.State.ExitCode') === 0) {
      return 'stopped';
    }
    // We don't know a better state, it was running at one point, but now
    // it's not running and it's exit code isn't 0. It must be crashed
    return 'crashed';

  }
  // If we don't have a container, but we have a build that means it's in some building state
  if (build) {
    if (build.completed && build.failed) {
      return 'buildFailed';
    }
    return 'building';
  }
  // Well, we have no container, we have no build. How the hell does this happen to us!
  return 'unknown';
};

/**
 * Is this instance currently migrating? (Not crashed/stopped/stopping and has dockRemoved flag)
 * @return {Boolean}
 */
Instance.prototype.isMigrating = function () {
  var status = this.status();
  if (~['crashed', 'stopped', 'stopping', 'buildFailed'].indexOf(status)) {
    return false;
  }
  return keypather.get(this, 'contextVersion.attrs.dockRemoved');
};

/**
 * Is this instance currently mirroring a Dockerfile?
 * @return {Boolean}
 */
Instance.prototype.hasDockerfileMirroring = function () {
  return !!keypather.get(this, 'contextVersion.attrs.buildDockerfilePath');
};

/**
 * Fork the instance giving it the branch and commit sha
 * @param {String} branch - Github branch name
 * @param {String} commitSha - Github commit SHA to set the fork to
 * @param {Function} cb - Callback method
 */
Instance.prototype.fork = function (branch, commitSha, cb) {
  var forkPath = path.join(this.path(id), 'fork');
  this.client.post(forkPath, {
    branch: branch,
    sha: commitSha
  }, function (err) {
    cb(err)
  });
};

/*global window:true */
'use strict';

var Boom = require('boom');
var exists = require('101/exists');
var find = require('101/find');
var hasProps = require('101/has-properties');
var isBrowser = typeof window !== 'undefined';
var isFunction = require('101/is-function');
var isString = require('101/is-string');
var keypather = require('keypather')();
var parseUrl = require('url').parse;
var Promise = require('bluebird');
var qs = require('querystring');
var util = require('util');

var ApiClient = require('../api-client');
var Base = require('./base');
var collectionStore = require('../stores/collection-store');
var modelStore = require('../stores/model-store');
var Socket = require('../socket');
var urlJoin = require('../url-join');

var masterHostnameErrMessage = 'not a master hostname';

function isMasterHostnameErr (err) {
  return keypather.get(err, 'output.payload.message') === masterHostnameErrMessage;
}

function isInvalidHostnameErr (err) {
  return keypather.get(err, 'output.statusCode') === 400 &&
      keypather.get(err, 'data.errorCode') === 'INVALID_HOSTNAME';
}

module.exports = User;

function User (attrsOrHost, opts) {
  if (!console.trace) {
    console.trace = function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('Trace:');
      console.log.apply(console, args);
      console.log(new Error('trace').stack);
    };
  }
  var attrs, host;
  if (isString(attrsOrHost)) {
    host = attrsOrHost;
    attrs = {};
  }
  else {
    attrs = attrsOrHost;
    host = null;
  }
  this.host = host || 'http://api.runnable.com';
  this.opts = opts || {};
  // if (!this.opts.userContentDomain) {
  //   throw new Error('user opts.userContentDomain is required');
  // }
  this.opts.client = this.opts.client || new ApiClient(this.host, this.opts.requestDefaults);

  Base.call(this, attrs, this.opts);
}

util.inherits(User, Base);

User.prototype.urlPath = 'users';

User.prototype.githubLogin = function (accessToken, cb) {
  if (isBrowser) {
    window.redirect('/auth/github');
  }
  else {
    var self = this;
    if (typeof accessToken === 'function') {
      cb = accessToken;
      cb(Boom.badRequest('you need an accessToken to login with GitHub'));
    } else {
      self.client.post('/auth/github/token',
        { json: { accessToken: accessToken }},
        function (err, res, body) {
          if (err) { return cb(err); }
          else if (res.statusCode !== 200) {
            var bodyMessage = keypather.get(body, 'message') || body;
            if (res.statusCode >= 400) {
              return cb(Boom.create(res.statusCode, bodyMessage));
            }
            if (res.statusCode === 302) {
              var headerLocation = keypather.get(res, 'headers.location');
              if (headerLocation && headerLocation.match(/whitelist.*false/i)) {
                return cb(Boom.unauthorized('User was authenticated, but does not belong to any whitelisted org'));
              }
            }
            var errorMessage = 'Error logging in (HTTP status code: ' + res.statusCode + ' )';
            if (bodyMessage) {
              errorMessage += ' (Message: ' + bodyMessage + ')';
            }
            return cb(Boom.create(500, errorMessage));
          }
          self.id('me');
          self.fetch(cb);
          var cookie = keypather.get(res, 'headers["set-cookie"][0]');
          if (cookie) {
            self.connectSid = cookie.split(';')[0].split('=')[1];
          }

        });
      return this; // return model
    }
  }
};

User.prototype.parse = function (attrs) {
  // Special property only exposed in /user/me and not exposed in the /user?githugOrgName route
  if (keypather.has(this, 'attrs.bigPoppaUser') && !keypather.has(attrs, 'bigPoppaUser')) {
    attrs.bigPoppaUser = this.attrs.bigPoppaUser;
  }
  return attrs;
};

/**
 * Creates the socket connection for updates from api, mainly for instances
 * DO NOT CALL THIS AT THE BEGINNING OF THE APP.  IF THE USER IS NOT AUTHED,
 * IT WILL CAUSE MASSIVE FAILURES LOGGING IN.  SO DON'T!
 * @returns {Object|*} socket
 */
User.prototype.createSocket = function (options) {
  if (!this.socket) {
    this.socket = new Socket(this.host, options);
    return this.socket;
  }
};

User.prototype.logout = function (cb) {
  this.client.delete('/auth', function (err, res, body) {
    modelStore.reset();
    collectionStore.reset();
    if (err) {
      cb(err);
    }
    else if (res.statusCode !== 200) {
      cb(Boom.create(res.statusCode, body.message || body));
    }
    else {
      cb(err, body, res.statusCode);
    }
  });
};
/**
 * should redirect user to API for login
 * @param  {object} redirect  url to redirect to after auth
 *                              format: <protocol>/<host>:<port>
 */
User.prototype.getGithubAuthUrl = function (redirect, forceLogin) {
  var opts = {
    requiresToken: 'yes',
    redirect: redirect
  };
  if (forceLogin) {
    opts.forceLogin = 'yes';
  }
  var query = qs.stringify(opts);
  return urlJoin(this.host, 'auth/github') + '?' + query;
};
User.prototype.isOwnerOf = function (model) {
  if (model.toJSON) {
    model = model.toJSON();
  }
  if (!model.owner) {
    throw new Error("model doesn't have an owner property");
  }
  if (!this.attrs.accounts) {
    throw new Error("user doesn't have account info");
  }
  return model.owner.github === this.attrs.accounts.github.id;
};

User.prototype.gravitar = function () {
  return this.attrs.gravatar;
};

User.prototype.oauthName = function () {
  return keypather.get(this, 'attrs.accounts.github.username');
};

User.prototype.oauthId = function () {
  return keypather.get(this.attrs, 'accounts.github.id');
};

// utils

/**
 * fetch internal ip for url (used by charon)
 * will return null if referer not found
 * @param  {String}   hostname           master pod instance url
 * @param  {String}   containerLocalIp   local ip address for the container making
 *                                       the request.
 * @param  {String}   localDockHost      local ip address of the dock host making this request
 * @param  {Function} cb                 callback(err, networkIp)
 */
User.prototype.fetchInternalIpForHostname = function (hostname, containerLocalIp, localDockHost, cb) {
  var self = this;
  // masterInstance exists
  var refererQuery = {
    'container.inspect.NetworkSettings.IPAddress': containerLocalIp,
    'container.dockerHost': localDockHost
  };
  self._fetchInstanceAndDepWithHostname(refererQuery, hostname, function (err, dep, instance) {
    if (err) {
      if (isInvalidHostnameErr(err)) {
        err.errorType = 'invalid-hostname';
      }

      return cb(err);
    }

    // Check if the dependency has a host ip
    if (hasHostIp(dep)) {
      return cb(null, dep.attrs.network.hostIp);
    }

    // no dependency found, check if in isolation so we can route if applicable
    self._fetchMasterInstanceByHostname(hostname, keypather.get(instance, 'attrs.isolated'), function (err, masterInstance) {
      if (err) {
        if (isMasterHostnameErr(err)) {
          err.errorType = 'not-master-hostname';
        }
        else if (isInvalidHostnameErr(err)) {
          err.errorType = 'invalid-hostname';
        }
        return cb(err);
      }
       // Check the master instance for a host ip
      if (hasHostIp(masterInstance)) {
        return cb(null, masterInstance.attrs.network.hostIp);
      }

      // If neither have one then error gracefully
      cb(new Error('Master instance missing `network.hostIp`'));
    });
  });

  function hasHostIp(instance) {
    return exists(keypather.get(instance, 'attrs.network.hostIp'));
  }
};

/**
 * check to see if requested url is a direct url
 * if it is, set mapping to that instance
 * if it is not, error with 404
 * directUrls are formated like this
 * <branch>-<repository>-<environment>-<organization>.runnableapp.com
 * we cannot rely on '-' being a delimiter therefore branch can not be parsed
 * search all permutations subtracting the last 2 `-` since they are guaranteed to exist
 * @param  {String}   directUrl format: <protocol>://<host>:<port>
 * @param  {Function} cb        callback(err)
 */
User.prototype.checkAndSetIfDirectUrl = function (directUrl, cb) {
  var self = this;
  var branchPerm = [];
  var carry = '';
  var hostname = parseUrl(directUrl).hostname;
  var parts = hostname.split('-');
  // remove last 2
  parts.splice(parts.length - 2, parts.length);
  // create all possible permutations of branch
  parts.forEach(function(value) {
    carry += value.toLowerCase();
    branchPerm.push(carry);
  });
  var instances = self.fetchInstances({
    name: {
      $in: branchPerm
    }
  }, function (err) {
    if (err) { return cb(err); }
    if (instances.models.length > 1) {
      return cb(Boom.create(404, 'there are multiple instances for this url', parts));
    }
    if (instances.models.length <= 0) {
      return cb(Boom.create(404, 'there is no instance for this url', parts));
    }
    var instance = instances.models[0];
    self.createRoute({
      srcHostname: hostname,
      destInstanceId: instance.attrs._id
    }, cb);
  });
};
/**
 * gets a backend based on the user mapping model
 * @param  {[type]}   url key to look for in mapping
 * @param  {Function} cb  (err, host)
 *                        host format: <protocol>://<host>:<port>
 *                        will always exist
 */
User.prototype.getBackendFromUserMapping = function (url, cb) {
  var self = this;
  var parsedUrl = parseUrl(url);
  self.fetchRoutes(function (err, mappings) {
    if (err) { return cb(err); }
    var targetMapping = find(mappings, hasProps({srcHostname: parsedUrl.hostname}));
    if (!targetMapping) { return cb(Boom.create(404, 'no mapping for this url')); }
    self.fetchInstances({
      _id: targetMapping.destInstanceId,
      githubUsername: self.attrs.accounts.github.username
    }, function (err, instances) {
      if (err) { return cb(err); }
      if (instances.models.length <= 0) {
        return cb(Boom.create(404, 'mapped instances no longer exist'));
      }
      var instance = instances.models[0];
      validateAndCbBackend(instance, parseUrl.port, cb);
    });
  });
};
/**
 * private function that gets the backend url of an instance and verifies the port is exposed
 * @param  {Object}    instance  instance model
 * @param  {Function}  cb        callback
 */
function validateAndCbBackend (instance, urlPort, cb) {
  var backendUrl = instance.dockerUrlForPort(urlPort);
  var err = validateContainer(instance.attrs.container);
  if (err) {
    return cb(err); }
  if (!backendUrl) {
    err = Boom.create(400, 'port not exposed', urlPort);
    return cb(err);
  }

  cb(null, backendUrl);
}
/**
 * validate container existence
 * @param  {Object} container instance.attrs.container - instance container json
 * @return {Error}  err       returns err only if container does not exist
 */
function validateContainer (container) {
  var err;
  if (!container || container.error) {
    err = Boom.create(504, 'instance is down (no container)', container.error);
  }
  else if (container.inspect.error) {
    err = Boom.create(503, 'instance inspect failed (try again)', container.inspect.error);
  }

  return err;
}

User.prototype.fetchInstancesPromise = function (query) {
  var self = this;
  return Promise.fromCallback(function (cb) {
    var instances = self.fetchInstances(query, function (err) {
      cb(err, instances)
    });
  });
};

/**
 * fetch master instance by hostname. If refer is isolated, check isolation group.
 * container not in isolation   => default to master
 * has a container in isolation => return error
 * @param {String}   hostname hostname of the instance's url
 * @param {Boolean}  isolated - isolated property of refer instance(s)
 * @param {Function} cb       callback(err, instanceModel) // Never calls back a null model
 * @throws {Boom.400} throws when no instance has been found
 * @throws {Error} from fetchInstances
 */
User.prototype._fetchMasterInstanceByHostname = function (hostname, isolated, cb) {
  if (isFunction(isolated)) {
    cb = isolated;
    isolated = null;
  }
  var opts = {
    hostname: hostname
  };

  // If we are isolated then check the isolated group
  if (isolated) {
    opts.isolated = isolated;
  } else {
    opts.masterPod = true;
  }

  this.fetchInstancesPromise(opts)
    .then(function (instance) {
      return keypather.get(instance, 'models[0]');
    })
    .then(function (instance) {
      if (!instance) {
        // this error message is used by isMasterHostnameErr method
        throw Boom.create(400, masterHostnameErrMessage, { hostname: hostname, opts: opts });
      }
      return instance;
    })
    .asCallback(cb);

};

/**
 * find an instance with the query and find its dependency with the shared hostname
 * @param  {Object}   query          instance url
 * @param  {String}   hostname       instance dependency hostname (shared with master pod)
 * @param  {Function} cb             callback(err, dep) // can callback null dep
 */
User.prototype._fetchInstanceAndDepWithHostname = function (query, hostname, cb) {
  // First, use the query to find THIS instance, ie the container making the query
  var instances = this.fetchInstances(query, function (err) {
    if (err) { return cb(err); }
    var instance = instances.models[0];
    if (!instance) {
      return cb(Boom.create(404, 'referer instance not found', {
        query: query,
        hostname: hostname
      }));
    }

    var query2 = { hostname: hostname };
    // Using that instance, fetch it's dependencies that match the target hostname
    var deps = instance.fetchDependencies(query2, function (err) {
      // This should be the specific instance THIS container is attempting to go to
      cb(err, deps.models[0], instance);
    });
  });
};

require('../extend-with-factories')(User, '');
require('../extend-with-factories')(User, 'user');

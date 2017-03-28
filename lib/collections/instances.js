'use strict';

var isBrowser = require('../is-browser');
var Base = require('./base');
var util = require('util');
var keypather = require('keypather')();
var clone = require('101/clone');
var find = require('101/find');
var exists = require('101/exists');
var hasKeypaths = require('101/has-keypaths');
var collectionStore = require('../stores/collection-store');

module.exports = Instances;

function Instances () {
  // bind methods used as event handlers
  this.handleSocketData = this.handleSocketData.bind(this);
  this.handleSocketReconnected = this.handleSocketReconnected.bind(this);
  // super constructor
  Base.apply(this, arguments);
  if (this.user.socket && !this.opts.noStore) {
    this.listenToSocketEvents();
  }
}

util.inherits(Instances, Base);

if (isBrowser) {
  // this is for the purposes of a warning only
  Instances.prototype.query = function (qs) {
    if (arguments.length === 1) {
      if (keypather.get(qs, 'owner.github') || qs['owner.github']) {
        console.log('warn! do not use "owner.github" to query instances for the frontend '+
          'socket events will only work when "githubUsername" is used');
      }
      this.qs = qs || {};
    }
    return this.qs;
  };
}


/**
 * listen to socket room data events (model's owner matches the socket room)
 */
Instances.prototype.listenToSocketEvents = function () {
  if (this.listening) { return; }
  this.listening = true;
  this.user.socket.on('data', this.handleSocketData);
  this.user.socket.on('reconnected', this.handleSocketReconnected);
};

/**
 * Store reconnecting so we know on open to re-fetch
 */
Instances.prototype.handleSocketReconnected = function () {
  var self = this;
  if (self.refreshOnDisconnect) {
    self.fetch(function () {
      self.emit('reconnection');
    });
  }

};

/**
 * stop listening to socket events
 */
Instances.prototype.stopListeningToSocketEvents = function () {
  if (!this.listening) {
    return;
  }
  this.listening = false;
  this.reconnecting = false;
  this.user.socket.off('data', this.handleSocketData);
  this.user.socket.off('reconnected', this.handleSocketReconnected);
};

Instances.prototype.dealloc = function () {
  this.stopListeningToSocketEvents(); // must be called before super dealloc
  Base.prototype.dealloc.call(this);
};

// TODO: optimization so that all collection do not have
//   to listen to all socket events. This can be done by
//   using the model-store, the cached /orgs collection and the user object.
// Instances.prototype.handleJoinRoom = function () {
// };

/**
 * socket data handler, listens to create events and detemines if the created
 * model needs to be added to the collection
 * @param  {Object} data socket event data
 */
Instances.prototype.handleSocketData = function (data) {
  var event = keypather.get(data, 'data.event');
  if (event !== 'INSTANCE_UPDATE') { return; }
  var self = this;
  var action = keypather.get(data, 'data.action');
  var newData = keypather.get(data, 'data.data');

  // We may get an event (such as deploy) before the post event
  // In that case, we want to add it anyway
  // In the case of us already having the instance, we'll ignore it with: !this.contains(newData)
  var updateEvents = [
    'isolation',
    'post',
    'update'
  ];

  if (newData && ~updateEvents.indexOf(action)) {
    // githubUsername should always exist
    var query = clone(this.query(), false);
    var githubUsername = query.githubUsername;
    if (githubUsername) {
      query['owner.username'] = githubUsername;
      delete query.githubUsername;
    }
    // Short circuit if our query does not include isolation related events and
    // we got notified with a non isolationGroupMaster instance
    if (!exists(query.isIsolationGroupMaster) &&
      !exists(query.isolated) &&
      keypather.get(newData, 'isIsolationGroupMaster') === false) {
      return;
    }
    if (hasKeypaths(newData, query) && // new data matches collection query
        !this.contains(newData)) {
      // FIXME:
      // Socket events are somehow duplicating models in collections and causing
      // all sorts of issues. We can rely on the fact that only one instance with
      // the same name should exist in any given instance collection (bc we only
      // query collections including userId or username)
      // Instances will have unique names for each owner
      var existing = find(self.models, hasKeypaths({'attrs.name': newData.name}));
      if (existing) {
        existing.reset(newData);
      } else {
        self.add(newData);
      }
      collectionStore.emit('collection:update:socket');
    }
  }
};

Instances.prototype.urlPath = 'instances';

Instances.prototype.Model = require('../models/instance');

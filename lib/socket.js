'use strict';

var util = require('util');
var uuid = require('uuid');
var noop = require('101/noop');
var equals = require('101/equals');
var findIndex = require('101/find-index');
var PrimusClient = require('./external/primus-client');

module.exports = Socket;

function Socket (url, options) {
  PrimusClient.call(this, url, options);
  this.orgRoom = null;
  this.orgMessageId = null;
  this.handleReconnected = this.handleReconnected.bind(this);
  this.writeJoinMessage = this.writeJoinMessage.bind(this);
  this._joinRoomHandlers = [];
  this.autoReconnect();
}

util.inherits(Socket, PrimusClient);

/**
 * join org (or user) room on the socket
 * @param  {String}   orgId aka room id
 * @param  {Function} cb    callback
 */
Socket.prototype.joinOrgRoom = function (orgId, cb) {
  cb = cb || noop;
  if (this.orgRoom) {
    delete this.rejoinRoomMessage;
    this.write({
      id: this.orgMessageId,
      event: 'subscribe',
      data: {
        action: 'leave',
        type: 'org',
        name: this.orgRoom
      }
    });
  }
  this.orgMessageId = makeUniqueId(orgId);
  this.orgRoom = orgId;
  var joinMessage = {
    id: this.orgMessageId,
    event: 'subscribe',
    data: {
      action: 'join',
      type: 'org',
      name: orgId
    }
  };
  this.rejoinRoomMessage = joinMessage;
  this.writeJoinMessage(this.rejoinRoomMessage, cb)
};

Socket.prototype.writeJoinMessage = function (message, cb) {
  var self = this;
  this.write(message);
  this.on('data', handleJoinRoom);
  function handleJoinRoom (data) {
    if (data.event === 'ROOM_ACTION_COMPLETE') {
      self.removeListener('data', handleJoinRoom);
      cb();
      self._joinRoomHandlers.forEach(function (handler) {
        handler(data);
      });
    }
  }
};

/**
 * attach a handler that gets invoked when a room is joined
 * @param  {Function} handler gets invoked when a room is joined
 */
Socket.prototype.onJoinRoom = function (handler) {
  this._joinRoomHandlers.push(handler);
};

/**
 * remove a handler so that it is no longer invoked when a room is joined
 * @param  {[type]} handler handler to remove
 */
Socket.prototype.offJoinRoom = function (handler) {
  var removeIndex = findIndex(this._joinRoomHandlers, equals(handler));
  this._joinRoomHandlers.splice(removeIndex, 1);
};


/**
 * socket connection reconnect handler
 */
Socket.prototype.handleReconnected = function () {
  if (this.rejoinRoomMessage) {
    this.writeJoinMessage(this.rejoinRoomMessage, function () {})
  }
};

/**
 * make the socket connection auto-reconnect
 */
Socket.prototype.autoReconnect = function () {
  this.on('reconnected', this.handleReconnected);
};

function makeUniqueId(streamId) {
  return streamId + uuid();
}

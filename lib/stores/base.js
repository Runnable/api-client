'use strict';

var EventEmitter = require('events').EventEmitter;

module.exports = Store;

function Store (opts) {
  EventEmitter.call(this);
  this.enabled = opts.enabled;
  this.hash = {};
  this.setMaxListeners(500);
}
require('util').inherits(Store, EventEmitter);

Store.prototype.get = function (key) {
  if (this.enabled) {
    return this.hash[key];
  }
};

Store.prototype.set = function (key, val) {
  if (this.enabled) {
    this.hash[key] = val;
    return this.hash[key];
  }
};

Store.prototype.remove = function (key) {
  if (this.enabled) {
    return (delete this.hash[key]);
  }
};

Store.prototype.reset = function () {
  this.hash = {};
};
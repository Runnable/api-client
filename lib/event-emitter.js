'use strict';

var util = require('util');
var exists = require('101/exists');
var EventEmitter = require('events').EventEmitter;
var isNode = require('./is-node');
var consoleWarn = require('./console-warn');

module.exports = ExtendedEventEmitter;

function ExtendedEventEmitter () {
  EventEmitter.call(this);
}

util.inherits(ExtendedEventEmitter, EventEmitter);

// extended addListener to warn in node
ExtendedEventEmitter.prototype.on =
ExtendedEventEmitter.prototype.addListener = function (event, handler, warn) {
  warn = exists(warn) ? warn : true;
  if (isNode && warn) {
    consoleWarn(
      'possible EventEmitter memory leak detected.',
      'listeners added in node.',
      'probably a mistake as most services wont have long living api-client models.',
      'Use "warn=false" to hide this warning.'
    );
  }
  return EventEmitter.prototype.addListener.apply(this, arguments);
};

ExtendedEventEmitter.prototype.off = function (event, handler) {
  if (arguments.length === 1) {
    this.removeAllListeners(event);
  }
  else {
    this.removeListener(event, handler);
  }
};

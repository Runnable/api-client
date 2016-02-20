'use strict';

/**
 * Context Dir Model
 */

var util = require('util');
var Base = require('../../base-dir');

module.exports = Dir;

function Dir () {
  return Base.apply(this, arguments);
}

util.inherits(Dir, Base);

Dir.prototype.contextId = function () {
  var opts = this.opts;
  if (!opts.contextId) {
    opts.contextId = opts.parentPath.split('/')[1];
  }
  return opts.contextId;
};

setTimeout(function () {
  Dir.prototype.FsList =
    require('../../../collections/context/version/fs-list');
}, 0); // circular dep

'use strict';

/**
 * Context File Model
 */

var util = require('util');
var path = require('path');
var exists = require('101/exists');
var Base = require('../../base-file');

module.exports = File;

function File () {
  Base.apply(this, arguments);
}

util.inherits(File, Base);

File.prototype.contextId = function () {
  var opts = this.opts;
  var partialPath = opts.parentPath || this.urlPath;
  if (!opts.contextId) {
    opts.contextId = partialPath.split('/')[1];
  }
  return opts.contextId;
};

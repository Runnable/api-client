'use strict';

/**
 * DebugContainer Dir Model
 */

var util = require('util');
var Base = require('../base-dir');

module.exports = Dir;

function Dir () {
  Base.apply(this, arguments);
}

util.inherits(Dir, Base);

Dir.prototype.urlPath = 'files';

setTimeout(function () {
  Dir.prototype.FsList =
    require('../../collections/debug-container/fs-list');
}, 0); // circular dep

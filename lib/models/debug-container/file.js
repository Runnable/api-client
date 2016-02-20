'use strict';

/**
 * Instance File Model
 */

var util = require('util');
var Base = require('../base-file');
module.exports = File;

function File () {
  Base.apply(this, arguments);
}

util.inherits(File, Base);

File.prototype.urlPath = 'files';

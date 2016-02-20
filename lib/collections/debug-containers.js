'use strict';

var Base = require('./base');
var util = require('util');
module.exports = DebugContainers;

function DebugContainers () {
  Base.apply(this, arguments);
}

util.inherits(DebugContainers, Base);

DebugContainers.prototype.urlPath = 'debug-containers';

DebugContainers.prototype.Model = require('../models/debug-container');

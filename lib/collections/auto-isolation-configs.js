'use strict';

var Base = require('./base');
var util = require('util');
module.exports = AutoIsolationConfig;

function AutoIsolationConfig () {
  Base.apply(this, arguments);
}

util.inherits(AutoIsolationConfig, Base);

AutoIsolationConfig.prototype.Model = require('../models/auto-isolation-config');

'use strict';

var Base = require('./base');
var util = require('util');
module.exports = AutoIsolationConfigs;

function AutoIsolationConfigs () {
  Base.apply(this, arguments);
}

util.inherits(AutoIsolationConfigs, Base);

AutoIsolationConfigs.prototype.Model = require('../models/auto-isolation-config');

'use strict';

var util = require('util');
var Base = require('./base');

module.exports = AutoIsolationConfig;

function AutoIsolationConfig () {
  return Base.apply(this, arguments);
}

util.inherits(AutoIsolationConfig, Base);

require('../extend-with-factories')(AutoIsolationConfig);

AutoIsolationConfig.prototype.urlPath = 'auto-isolation-configs';

'use strict';

var Base = require('./base');
var util = require('util');
module.exports = Settings;

function Settings () {
  Base.apply(this, arguments);
}

util.inherits(Settings, Base);

Settings.prototype.urlPath = 'settings';

Settings.prototype.Model = require('../models/setting');

'use strict';

var Base = require('./base');
var util = require('util');
module.exports = AllInstances;

function AllInstances () {
  Base.apply(this, arguments);
}

util.inherits(AllInstances, Base);

AllInstances.prototype.urlPath = 'allInstances';

AllInstances.prototype.Model = require('../models/instance');

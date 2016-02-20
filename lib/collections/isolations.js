'use strict';

var Base = require('./base');
var util = require('util');
module.exports = Isolations;

function Isolations () {
  Base.apply(this, arguments);
}

util.inherits(Isolations, Base);

Isolations.prototype.Model = require('../models/isolation');
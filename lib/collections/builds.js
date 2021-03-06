'use strict';

var Base = require('./base');
var util = require('util');
module.exports = Builds;

function Builds () {
  Base.apply(this, arguments);
}

util.inherits(Builds, Base);

Builds.prototype.urlPath = 'builds';

Builds.prototype.Model = require('../models/build');
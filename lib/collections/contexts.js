'use strict';

var Base = require('./base');
var util = require('util');
module.exports = Contexts;

function Contexts () {
  Base.apply(this, arguments);
}

util.inherits(Contexts, Base);

Contexts.prototype.urlPath = 'contexts';

Contexts.prototype.Model = require('../models/context');

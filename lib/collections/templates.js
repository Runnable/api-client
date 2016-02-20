'use strict';

var Base = require('./base');
var util = require('util');
module.exports = Templates;

function Templates () {
  Base.apply(this, arguments);
}

util.inherits(Templates, Base);

Templates.prototype.urlPath = 'templates';

Templates.prototype.Model = require('../models/template');

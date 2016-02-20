'use strict';

var Base = require('../base');
var util = require('util');
module.exports = Dependencies;

function Dependencies () {
  Base.apply(this, arguments);
}

util.inherits(Dependencies, Base);

require('../../extend-with-factories')(Dependencies, 'instance/dependency');

Dependencies.prototype.urlPath = 'dependencies';

Dependencies.prototype.Model = require('../../models/instance/dependency');


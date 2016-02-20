'use strict';

var Base = require('../base');
var util = require('util');
module.exports = Routes;

function Routes () {
  Base.apply(this, arguments);
}

util.inherits(Routes, Base);

Routes.prototype.urlPath = 'routes';

Routes.prototype.Model = require('../../models/user/route');
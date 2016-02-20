'use strict';

var util = require('util');
var Base = require('../base');

module.exports = Route;

function Route () {
  Base.apply(this, arguments);
}

util.inherits(Route, Base);

Route.prototype.path = function (id) {
  id = id || this.id() || '';
  return Base.prototype.path.call(this, encodeURIComponent(id));
};

Route.prototype.urlPath = 'routes';

Route.prototype.idAttribute = 'srcHostname';

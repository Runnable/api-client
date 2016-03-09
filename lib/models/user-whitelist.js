'use strict';

var util = require('util');
var Base = require('./base');

module.exports = UserWhitelist;

function UserWhitelist () {
  return Base.apply(this, arguments);
}

util.inherits(UserWhitelist, Base);

require('../extend-with-factories')(UserWhitelist);

UserWhitelist.prototype.urlPath = 'auth/whitelist';

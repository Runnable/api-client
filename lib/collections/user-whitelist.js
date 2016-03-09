'use strict';

var Base = require('./base');
var util = require('util');
module.exports = UserWhitelists;

function UserWhitelists () {
  Base.apply(this, arguments);
}

util.inherits(UserWhitelists, Base);

UserWhitelists.prototype.urlPath = 'auth/whitelist';

UserWhitelists.prototype.Model = require('../models/user-whitelist.js');

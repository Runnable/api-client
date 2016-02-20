'use strict';

var Base = require('./base');
var util = require('util');
module.exports = TeammateInvitations;

function TeammateInvitations () {
  Base.apply(this, arguments);
}

util.inherits(TeammateInvitations, Base);

TeammateInvitations.prototype.urlPath = 'teammate-invitation';

TeammateInvitations.prototype.Model = require('../models/teammate-invitation');

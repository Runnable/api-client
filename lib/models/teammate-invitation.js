'use strict';

var util = require('util');
var Base = require('./base');

module.exports = TeammateInvitation;

function TeammateInvitation () {
  return Base.apply(this, arguments);
}

util.inherits(TeammateInvitation, Base);

require('../extend-with-factories')(TeammateInvitation);

TeammateInvitation.prototype.urlPath = 'teammate-invitation';

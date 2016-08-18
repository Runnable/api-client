'use strict';

var moment = require('moment');
var util = require('util');
var Base = require('./base');

module.exports = UserWhitelist;

function UserWhitelist () {
  return Base.apply(this, arguments);
}

UserWhitelist.prototype.isInTrial = function () {
  return moment(this.attrs.trialEnd) > moment().utc();
};

UserWhitelist.prototype.isInGrace = function () {
  return !this.isInTrial() && moment(this.attrs.gracePeriodEnd) > moment().utc();
};

UserWhitelist.prototype.isInActivePeriod = function () {
  return moment(this.attrs.activePeriodEnd) > moment().utc();
};

UserWhitelist.prototype.isGraceExpired = function () {
  return !this.isInTrial() && moment.utc(this.attrs.gracePeriodEnd) < moment().utc();
};

UserWhitelist.prototype.trialDaysRemaining = function () {
  return moment(this.attrs.trialEnd).diff(moment.utc(), 'days');
};

UserWhitelist.prototype.graceHoursRemaining = function () {
  return moment(this.attrs.gracePeriodEnd).diff(moment.utc(), 'hours');
};

util.inherits(UserWhitelist, Base);

require('../extend-with-factories')(UserWhitelist);

UserWhitelist.prototype.urlPath = 'auth/whitelist';

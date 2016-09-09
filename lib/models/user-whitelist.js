'use strict';

var moment = require('moment');
var util = require('util');
var Base = require('./base');

module.exports = UserWhitelist;

function UserWhitelist () {
  return Base.apply(this, arguments);
}

util.inherits(UserWhitelist, Base);

require('../extend-with-factories')(UserWhitelist);

/**
 * Is an organization in a trial period?
 * @returns {boolean}
 */
UserWhitelist.prototype.isInTrial = function () {
  return !this.isInActivePeriod() && !moment(this.attrs.trialEnd) > moment.utc();
};

/**
 * Is the organization in a grace period?
 * @returns {boolean}
 */
UserWhitelist.prototype.isInGrace = function () {
  return !this.isInTrial() && moment(this.attrs.gracePeriodEnd) > moment.utc();
};

/**
 * Is the organization in an active period?
 * @returns {boolean}
 */
UserWhitelist.prototype.isInActivePeriod = function () {
  return moment(this.attrs.activePeriodEnd) > moment.utc();
};

/**
 * Has the organizations grace period expired?
 * @returns {boolean}
 */
UserWhitelist.prototype.isGraceExpired = function () {
  return !this.isInTrial() && moment(this.attrs.gracePeriodEnd) < moment.utc();
};

/**
 * How many days are remaining in the trial?
 * @returns {Integer} - Days remaining in trial
 */
UserWhitelist.prototype.trialDaysRemaining = function () {
  return moment(this.attrs.trialEnd).diff(moment.utc(), 'days') + 1;
};

/**
 * How many hours are remaining in the grace period?
 * @returns {Integer} - Hours remaining in grace period
 */
UserWhitelist.prototype.graceHoursRemaining = function () {
  return moment(this.attrs.gracePeriodEnd).diff(moment.utc(), 'hours');
};

UserWhitelist.prototype.urlPath = 'auth/whitelist';

'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var UserWhitelist = require('../lib/models/user-whitelist');
var noop = require('101/noop');
var moment = require('moment');
require('sinon-as-promised')(require('bluebird'))

var mockClient = {
  del: noop,
  patch: noop,
  post: noop,
  put: noop
};
var userContentDomain = 'runnableapp.com';
var modelOpts = {
  client: mockClient,
  userContentDomain: userContentDomain
};
describe('user-whitelist', function () {
  var ctx;

  beforeEach(function (done) {
    ctx = {};
    done();
  });


  describe('payment stuff', function () {
    var yesterday;
    var twoWeeks;
    describe('is active', function () {
      beforeEach(function () {
        yesterday = moment().subtract(2, 'hours').utc()
        twoWeeks = moment().add(2, 'weeks').utc()
        ctx.userWhitelist = new UserWhitelist({
          trialEnd: yesterday,
          gracePeriodEnd: twoWeeks,
          activePeriodEnd: twoWeeks
        }, modelOpts);

      });

      it('should be active', function (done) {
        expect(ctx.userWhitelist.isInActivePeriod()).to.be.true;
        done();
      });
      it('should not be in trial', function (done) {
        expect(ctx.userWhitelist.isInTrial()).to.be.false;
        done();
      });
      it('should not be in grace period', function (done) {
        expect(ctx.userWhitelist.isInGrace()).to.be.false;
        done();
      });
    });
    describe('is in trial', function () {
      beforeEach(function () {
        yesterday = moment().subtract(2, 'hours').utc()
        twoWeeks = moment().add(2, 'weeks').utc()
        ctx.userWhitelist = new UserWhitelist({
          trialEnd: twoWeeks,
          gracePeriodEnd: twoWeeks,
          activePeriodEnd: yesterday
        }, modelOpts);

      });

      it('should not be active', function (done) {
        expect(ctx.userWhitelist.isInActivePeriod()).to.be.false;
        done();
      });
      it('should be in trial', function (done) {
        expect(ctx.userWhitelist.isInTrial()).to.be.true;
        done();
      });
      it('should not be in grace period', function (done) {
        expect(ctx.userWhitelist.isInGrace()).to.be.false;
        done();
      });
    });
    describe('is in grace', function () {
      beforeEach(function () {
        yesterday = moment().subtract(2, 'hours').utc()
        twoWeeks = moment().add(2, 'weeks').utc()
        ctx.userWhitelist = new UserWhitelist({
          trialEnd: yesterday,
          gracePeriodEnd: twoWeeks,
          activePeriodEnd: yesterday
        }, modelOpts);

      });

      it('should not be active', function (done) {
        expect(ctx.userWhitelist.isInActivePeriod()).to.be.false;
        done();
      });
      it('should not be in trial', function (done) {
        expect(ctx.userWhitelist.isInTrial()).to.be.false;
        done();
      });
      it('should be in grace period', function (done) {
        expect(ctx.userWhitelist.isInGrace()).to.be.true;
        done();
      });
    });

  });
});

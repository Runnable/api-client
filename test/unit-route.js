'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var User = require('../lib/models/user');
var Route = require('../lib/models/user/route');

var mockClient = {
  post: sinon.spy(),
  patch: sinon.spy(),
  del: sinon.spy()
};
var userContentDomain = 'runnableapp.com';
var modelOpts = {
  client: mockClient,
  userContentDomain: userContentDomain
};
describe('route', function () {
  var ctx;

  beforeEach(function (done) {
    ctx = {};
    done();
  });

  describe('constructor', function () {
    it('should have the right path', function(done) {
      var user = new User({}, modelOpts);
      var srcHostname = 'hello.runnableapp.com';
      var route = user.newRoute({ srcHostname: srcHostname }, modelOpts);
      expect(route.path()).to.equal('users/me/routes/'+encodeURIComponent(srcHostname));
      done();
    });
  });
});
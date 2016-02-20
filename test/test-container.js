var User = require('../index');
var expect = require('chai').expect;
var last = require('101/last');
var noop = require('101/noop');
var keypather = require('keypather')();

describe('containers', function() {
  var ctx = {};
  beforeEach(function (done) {
    var user = new User();
    ctx.container = user
      .newInstance('instanceId')
      .newContainer('containerId');
    done();
  });
  afterEach(function (done) {
    ctx = {};
    done();
  });
  describe('Urls', function() {
    it('should create a valid url', function (done) {
      ctx.container.client.host = 'http://api.runnable.io';
      ctx.container.opts.instanceName = 'testing';
      ctx.container.opts.ownerUsername = 'username';
      keypather.set(ctx.container, 'attrs.inspect.NetworkSettings.Ports',
        {'80/tmp': true, '400/tmp': true});
      var expected = ['http://testing.username.runnable.io',
        'http://testing.username.runnable.io:400'];
      var result = ctx.container.urls();
      for (var x = 0; x < result.length; x++) {
        expect(result[x]).to.equal(expected[x]);
      }
      done();
    });
    it('should create a valid url including https', function (done) {
      ctx.container.client.host = 'http://api.runnable.io';
      ctx.container.opts.instanceName = 'testing';
      ctx.container.opts.ownerUsername = 'username';
      keypather.set(ctx.container, 'attrs.inspect.NetworkSettings.Ports',
        {'80/tmp': true, '443/tcp': true, '400/tmp': true});
      var expected = ['http://testing.username.runnable.io',
        'https://testing.username.runnable.io',
        'http://testing.username.runnable.io:400'];
      var result = ctx.container.urls();
      for (var x = 0; x < result.length; x++) {
        expect(result[x]).to.equal(expected[x]);
      }
      done();
    });
    it('should create a valid url if the host already has a port', function (done) {
      ctx.container.client.host = 'http://api.runnable.io:3030';
      ctx.container.opts.instanceName = 'testing';
      ctx.container.opts.ownerUsername = 'username';
      keypather.set(ctx.container, 'attrs.inspect.NetworkSettings.Ports',
        {'80/tmp': true, '400/tmp': true});
      var expected = ['http://testing.username.runnable.io',
        'http://testing.username.runnable.io:400'];
      var result = ctx.container.urls();
      for (var x = 0; x < result.length; x++) {
        expect(result[x]).to.equal(expected[x]);
      }
      done();
    });
  });
});

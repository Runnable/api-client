var expect = require('chai').expect;
var noop = require('101/noop');
var Dependency = require('../lib/models/instance/dependency');
var keypather = require('keypather')();
var sinon = require('sinon');

var mockClient = {
  post: noop,
  patch: noop,
  del: noop
};
var modelOpts = {
  client: mockClient
};

describe('dependency model', function () {
  var ctx = {};
  beforeEach(function (done) {
    ctx = {};
    ctx.dependency = new Dependency({}, modelOpts);
    done();
  });

  describe('dockerUrlForPort', function () {
    it('should error if not passed a port', function (done) {
      var i = ctx.dependency;
      try {
        i.dockerUrlForPort();
      }
      catch (e) {
        expect(e).to.be.ok;
        expect(e.message).to.ok;
        expect(e.message)
          .to.match(/required/i)
          .to.match(/port/i);
        done();
      }
    });

    describe('has all properties', function () {
      beforeEach(function (done) {
        ctx.exposedPort = 80;
        var data = {};
        keypather.set(data, 'container.dockerHost', 'http://10.0.1.10:4242');
        keypather.set(data, 'container.ports["'+ctx.exposedPort+'/tcp"][0]', {
          HostIp: '0.0.0.0',
          HostPort: 49012
        });
        ctx.dependency.extend(data);
        done();
      });

      it('should get the docker url', function (done) {
        expect(ctx.dependency.dockerUrlForPort(ctx.exposedPort)).to.equal('http://10.0.1.10:49012/');
        done();
      });
    });
  });

  describe('path', function () {
    it('should use the hostname as the id (urlEncoded)', function(done) {
      var attrs = {
        hostname: 'h-e-l-l-o.google.com',
        instance: '123456789012345678901234'
      };
      ctx.dependency.reset(attrs);
      expect(ctx.dependency.path())
        .to.equal('dependencies/'+encodeURIComponent(attrs.hostname));
      done();
    });
  });

  describe('parse', function () {
    it('should create an instance object and store it on the local', function(done) {
      var attrs = {
        id: '1234'
      };
      ctx.dependency.user = {
        newInstance: sinon.stub().returns({ newInstance: true })
      };
      ctx.dependency.parse(attrs);
      sinon.assert.calledOnce(ctx.dependency.user.newInstance);
      expect(ctx.dependency.instance).to.exist;
      done();
    });
  });
});

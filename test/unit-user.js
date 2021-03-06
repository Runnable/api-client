'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var User = require('../lib/models/user');
var last = require('101/last');
var noop = require('101/noop');
var assign = require('101/assign');
var parseUrl = require('url').parse;
var Boom = require('boom');
require('sinon-as-promised')(require('bluebird'))

describe('user', function () {
  var ctx;

  beforeEach(function (done) {
    ctx = {};
    ctx.user = new User();
    done();
  });

  describe('constructor', function () {
    it('should initialize the api-user with defaults', function (done) {
      var user = ctx.user;
      expect(user.host).to.equal('http://api.runnable.com');
      expect(user.attrs).to.eql({});
      expect(user.opts.client).to.be.ok;
      done();
    });
  });

  describe('githubLogin', function () {
    var accessToken = 'a123';
    beforeEach(function () {
      sinon.stub(ctx.user, 'id');
      sinon.stub(ctx.user, 'fetch').callsArg(0);
      sinon.stub(ctx.user.client, 'post');
    });

    it('should return be a bad request if accessToken is a function', function (done) {
      ctx.user.githubLogin(function (err) {
        expect(err).to.exist();
        expect(err.message).to.match(/need.*accessToken.*login.*github/i);
        done();
      });
    });

    it('should fetch the user if the user was property authenticated', function (done) {
      var body = {};
      ctx.user.client.post.yields(null, {
        statusCode: 200,
        headers: {
          'set-cookie': 'connect.sid=123412;'
        }
      }, body);

      var callback = function (err) {
        expect(err).to.not.exist();
        sinon.assert.calledOnce(ctx.user.client.post);
        sinon.assert.calledWith(
          ctx.user.client.post,
          '/auth/github/token',
          { json: { accessToken: accessToken }}
        );
        sinon.assert.calledOnce(ctx.user.id);
        sinon.assert.calledWith(ctx.user.id, 'me');
        sinon.assert.calledOnce(ctx.user.fetch);
        sinon.assert.calledWith(ctx.user.fetch, callback);
        done();
      };
      ctx.user.githubLogin(accessToken, callback);
    });

    it('should throw a boom error if there is 400/500 error', function (done) {
      var body = { message: 'hello world' };
      ctx.user.client.post.yields(null, {
        statusCode: 401
      }, body);
      ctx.user.githubLogin(accessToken, function (err) {
        expect(err).to.exist();
        sinon.assert.calledOnce(ctx.user.client.post);
        sinon.assert.calledWith(
          ctx.user.client.post,
          '/auth/github/token',
          { json: { accessToken: accessToken }}
        );
        expect(err.message).to.equal(body.message);
        expect(err.output.statusCode).to.equal(401);
        sinon.assert.notCalled(ctx.user.id);
        sinon.assert.notCalled(ctx.user.fetch);
        done();
      });
    });

    it('should throw a special error if the user is able to login but does not belong to any whitelisted orgs', function (done) {
      var body = { message: 'hello world' };
      ctx.user.client.post.yields(null, {
        statusCode: 302,
        headers: {
          'location': 'runnable.io/?whitelist=false'
        }
      }, body);
      ctx.user.githubLogin(accessToken, function (err) {
        expect(err).to.exist();
        sinon.assert.calledOnce(ctx.user.client.post);
        sinon.assert.calledWith(
          ctx.user.client.post,
          '/auth/github/token',
          { json: { accessToken: accessToken }}
        );
        expect(err.message).to.match(/authenticated.*whitelist.*org/i);
        sinon.assert.notCalled(ctx.user.id);
        sinon.assert.notCalled(ctx.user.fetch);
        done();
      });
    });

    it('should throw a generic error when there is no 400 or 302/whitelist error', function (done) {
      var body = { message: 'hello world' };
      ctx.user.client.post.yields(null, {
        statusCode: 302,
      }, body);
      ctx.user.githubLogin(accessToken, function (err) {
        expect(err).to.exist();
        sinon.assert.calledOnce(ctx.user.client.post);
        sinon.assert.calledWith(
          ctx.user.client.post,
          '/auth/github/token',
          { json: { accessToken: accessToken }}
        );
        expect(err.message).to.match(/error.*logging.*in/i);
        expect(err.message).to.match(/hello.*world/i);
        sinon.assert.notCalled(ctx.user.id);
        sinon.assert.notCalled(ctx.user.fetch);
        done();
      });
    });
  });

  describe('getGithubAuthUrl', function () {
    it('should return correct url', function (done) {
      var user = ctx.user;
      var redirectUrl = 'http://someurl.com/path';

      expect(user.getGithubAuthUrl(redirectUrl))
        .to.equal(
          'http://api.runnable.com/auth/github'+
          '?requiresToken=yes&redirect='+encodeURIComponent(redirectUrl)
        );
      done();
    });
    it('should return correct url with forceLogin', function (done) {
      var user = ctx.user;
      var redirectUrl = 'http://someurl.com/path';

      expect(user.getGithubAuthUrl(redirectUrl, true))
        .to.equal(
          'http://api.runnable.com/auth/github'+
          '?requiresToken=yes&redirect='+encodeURIComponent(redirectUrl)+'&forceLogin=yes'
        );
      done();
    });
  });

  describe('loggedIn methods', function () {
    beforeEach(function (done) {
      ctx.githubLoginSpy = sinon.stub(User.prototype, 'githubLogin');
      ctx.user.githubLogin('token', noop);
      ctx.login = ctx.githubLoginSpy.firstCall.args[1]; // login callback
      ctx.fetchInstancesSpy = sinon.stub(ctx.user, 'fetchInstances');
      done();
    });
    afterEach(function (done) {
      ctx.githubLoginSpy.restore();
      ctx.fetchInstancesSpy.restore();
      done();
    });
    describe('checkAndSetIfDirectUrl', function () {
      var testDirectUrl = 'http://branch-repo-stageing-org.runnableapp.com:80';
      it('should 404 if not found', function(done) {
        ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [] })
            .yieldsAsync(null);
        ctx.user.checkAndSetIfDirectUrl(testDirectUrl, function (err) {
          expect(err.output.statusCode).to.equal(404);
          done();
        });
      });
      it('should 404 if more then one instance found', function(done) {
        ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [1,2,3] })
            .yieldsAsync(null);
        ctx.user.checkAndSetIfDirectUrl(testDirectUrl, function (err) {
          expect(err.output.statusCode).to.equal(404);
          done();
        });
      });
      it('should error if fetch had error', function(done) {
        var testErr = 'someerr';
        ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [] })
            .yieldsAsync(testErr);
        ctx.user.checkAndSetIfDirectUrl(testDirectUrl, function (err) {
          expect(err).to.equal(testErr);
          done();
        });
      });
      it('should create route if once instance found', function(done) {
        var testHostName = 'branch-repo';
        var testId = '55428bea1ec12f1800a9513c';
        sinon.stub(ctx.user, 'createRoute').yields();
        ctx.fetchInstancesSpy
            .onCall(0)
            .returns({
              models: [{
                attrs: {
                  hostname: testHostName,
                  _id: testId
                }
              }]
            })
            .yieldsAsync(null);
        ctx.user.checkAndSetIfDirectUrl(testDirectUrl, function (err) {
          expect(err).to.not.exist();
          expect(ctx.user.createRoute
            .calledWith({
              srcHostname: 'branch-repo-stageing-org.runnableapp.com',
              destInstanceId: testId
            })).to.be.true();
          done();
        });
      });
    });
    describe('fetchInternalIpForHostname', function () {
      var dockerHost =  'http://10.12.199.84:4242';
      beforeEach(function (done) {
        ctx.mockInstance = {
          attrs: {
            owner: {
              username: 'tjmehta'
            },
            network: {
              hostIp: 'http://10.0.1.0'
            },
            container: {
              dockerHost: '10.20.0.0'
            },
            isolated: 'asdfsadfasdfsd'
          }
        };
        ctx.mockDep = {
          attrs: {
            network: {
              hostIp: 'http://10.0.2.0'
            }
          }
        };
        ctx.fetchMasterSpy = sinon.stub(ctx.user, '_fetchMasterInstanceByHostname');
        ctx.fetchDepSpy = sinon.stub(ctx.user, '_fetchInstanceAndDepWithHostname');
        done();
      });
      afterEach(function (done) {
        ctx.fetchMasterSpy.restore();
        ctx.fetchDepSpy.restore();
        done();
      });

      describe('success', function () {
        it('should cb internal ip of master instance if dep not found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null, ctx.mockInstance);
          ctx.fetchMasterSpy.yieldsAsync(null, ctx.mockInstance);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.not.exist();
            expect(hostIp).to.exist();
            expect(hostIp).to.equal(ctx.mockInstance.attrs.network.hostIp);

            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            expect(ctx.fetchMasterSpy.firstCall.args[1]).to.deep.equal('asdfsadfasdfsd');

            done();
          });
        });

        it('should cb internal ip of dep instance if found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, ctx.mockDep);
          ctx.fetchMasterSpy.yieldsAsync(null, null);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.not.exist();
            expect(hostIp).to.exist();
            expect(hostIp).to.equal(ctx.mockDep.attrs.network.hostIp);

            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.not.be.true();
            done();
          });
        });
      });

      describe('errors', function () {
        it('should clearly indicate invalid hostname for master', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null);
          ctx.fetchMasterSpy.restore(); // no spy
          ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [] })
            .yieldsAsync(Boom.badRequest('invalid hostname', { errorCode: 'INVALID_HOSTNAME' }));
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('invalid-hostname');
            expect(hostIp).to.not.exist();
            expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
            expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
              hostname: hostname,
              masterPod: true
            });
            done();
          });
        });

        it('should clearly indicate an invalid hostname for dep', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [ctx.mockInstance] })
            .yieldsAsync(null, ctx.mockInstance);
          ctx.fetchDepSpy.yieldsAsync(Boom.badRequest('invalid hostname', { errorCode: 'INVALID_HOSTNAME' }));
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('invalid-hostname');
            expect(hostIp).to.not.exist();
            done();
          });
        });

        it('should clearly indicate if master instance w/ hostname not found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.restore(); // no spy
          ctx.fetchDepSpy.yieldsAsync(null, null);
          ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [] })
            .yieldsAsync(null, []);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('not-master-hostname')
            expect(hostIp).to.not.exist();

            expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
            expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
              hostname: hostname,
              masterPod: true
            });
            done();
          });
        });

        it('should callback an error if _fetchMasterInstanceByHostname errors', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null);
          var fetchErr = new Error();
          ctx.fetchMasterSpy.yieldsAsync(fetchErr);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err).to.equal(fetchErr);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            done();
          });
        });

        it('should callback an error if _fetchInstanceAndDepWithHostname errors', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          var fetchErr = new Error();
          ctx.fetchMasterSpy.yieldsAsync(null, null);
          ctx.fetchDepSpy.yieldsAsync(fetchErr);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err).to.equal(fetchErr);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.not.be.true();
            done();
          });
        });

        it('should gracefully handle missing `network.hostIp`', function(done) {
          var missingHostIp = {
            attrs: {
              owner: {
                username: 'tjmehta'
              },
              network: {
              },
              container: {
                dockerHost: '10.20.0.0'
              }
            }
          };
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.yieldsAsync(null, missingHostIp);
          ctx.fetchDepSpy.yieldsAsync(null, missingHostIp);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err.message).to.match(/network\.hostIp/);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            done();
          });
        });

        it('should gracefully handle missing `network`', function(done) {
          var missingHostIp = {
            attrs: {
              owner: {
                username: 'tjmehta'
              },
              container: {
                dockerHost: '10.20.0.0'
              }
            }
          };
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.yieldsAsync(null, missingHostIp);
          ctx.fetchDepSpy.yieldsAsync(null, missingHostIp);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err.message).to.match(/network\.hostIp/);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            done();
          });
        });
      });
    });
    describe('fetchInternalIpForHostname', function () {
      var dockerHost =  'http://10.12.199.84:4242';
      beforeEach(function (done) {
        ctx.mockInstance = {
          attrs: {
            owner: {
              username: 'tjmehta'
            },
            network: {
              hostIp: 'http://10.0.1.0'
            },
            container: {
              dockerHost: '10.20.0.0'
            }
          }
        };
        ctx.mockDep = {
          attrs: {
            network: {
              hostIp: 'http://10.0.2.0'
            }
          }
        };
        ctx.fetchMasterSpy = sinon.stub(ctx.user, '_fetchMasterInstanceByHostname');
        ctx.fetchDepSpy = sinon.stub(ctx.user, '_fetchInstanceAndDepWithHostname');
        done();
      });
      afterEach(function (done) {
        ctx.fetchMasterSpy.restore();
        ctx.fetchDepSpy.restore();
        done();
      });

      describe('success', function () {
        it('should cb internal ip of master instance if dep not found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null);
          ctx.fetchMasterSpy.yieldsAsync(null, ctx.mockInstance);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.not.exist();
            expect(hostIp).to.exist();
            expect(hostIp).to.equal(ctx.mockInstance.attrs.network.hostIp);

            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);

            done();
          });
        });

        it('should cb internal ip of dep instance if found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, ctx.mockDep);
          ctx.fetchMasterSpy.yieldsAsync(null, null);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.not.exist();
            expect(hostIp).to.exist();
            expect(hostIp).to.equal(ctx.mockDep.attrs.network.hostIp);

            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.not.be.true();
            done();
          });
        });
      });

      describe('errors', function () {
        it('should clearly indicate invalid hostname for master', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null);
          ctx.fetchMasterSpy.restore(); // no spy
          ctx.fetchInstancesSpy
            .onCall(0)
              .returns({ models: [] })
              .yieldsAsync(Boom.badRequest('invalid hostname', { errorCode: 'INVALID_HOSTNAME' }));
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('invalid-hostname');
            expect(hostIp).to.not.exist();
            expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
            expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
              hostname: hostname,
              masterPod: true
            });
            done();
          });
        });

        it('should clearly indicate an invalid hostname for dep', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchInstancesSpy
            .onCall(0)
              .returns({ models: [ctx.mockInstance] })
              .yieldsAsync(null, ctx.mockInstance);
          ctx.fetchDepSpy.yieldsAsync(Boom.badRequest('invalid hostname', { errorCode: 'INVALID_HOSTNAME' }));
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('invalid-hostname');
            expect(hostIp).to.not.exist();
            done();
          });
        });

        it('should clearly indicate if master instance w/ hostname not found', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.restore(); // no spy
          ctx.fetchDepSpy.yieldsAsync(null, null);
          ctx.fetchInstancesSpy
            .onCall(0)
            .returns({ models: [] })
            .yieldsAsync(null, []);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err, hostIp) {
            expect(err).to.exist();
            expect(err.errorType).to.equal('not-master-hostname')
            expect(hostIp).to.not.exist();

            expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
            expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
              hostname: hostname,
              masterPod: true
            });
            done();
          });
        });

        it('should callback an error if _fetchMasterInstanceByHostname errors', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchDepSpy.yieldsAsync(null, null);
          var fetchErr = new Error();
          ctx.fetchMasterSpy.yieldsAsync(fetchErr);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err).to.equal(fetchErr);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            done();
          });
        });

        it('should callback an error if _fetchInstanceAndDepWithHostname errors', function (done) {
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          var fetchErr = new Error();
          ctx.fetchMasterSpy.yieldsAsync(null, null);
          ctx.fetchDepSpy.yieldsAsync(fetchErr);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err).to.equal(fetchErr);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.not.be.true();
            done();
          });
        });

        it('should gracefully handle missing `network.hostIp`', function(done) {
          var missingHostIp = {
            attrs: {
              owner: {
                username: 'tjmehta'
              },
              network: {
              },
              container: {
                dockerHost: '10.20.0.0'
              }
            }
          };
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.yieldsAsync(null, missingHostIp);
          ctx.fetchDepSpy.yieldsAsync(null, missingHostIp);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err.message).to.match(/network\.hostIp/);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            done();
          });
        });

        it('should gracefully handle missing `network`', function(done) {
          var missingHostIp = {
            attrs: {
              owner: {
                username: 'tjmehta'
              },
              container: {
                dockerHost: '10.20.0.0'
              }
            }
          };
          var hostname = 'api-codenow.runnableapp.com';
          var localIp = '10.0.3.0';
          ctx.fetchMasterSpy.yieldsAsync(null, missingHostIp);
          ctx.fetchDepSpy.yieldsAsync(null, missingHostIp);
          ctx.user.fetchInternalIpForHostname(hostname, localIp, dockerHost, function (err) {
            expect(err).to.exist();
            expect(err.message).to.match(/network\.hostIp/);
            expect(ctx.fetchMasterSpy.calledOnce).to.be.true();
            expect(ctx.fetchMasterSpy.firstCall.args[0]).to.deep.equal(hostname);
            expect(ctx.fetchDepSpy.calledOnce).to.be.true();
            expect(ctx.fetchDepSpy.firstCall.args[0]).to.deep.equal({
              'container.inspect.NetworkSettings.IPAddress': localIp,
              'container.dockerHost': dockerHost
            });
            expect(ctx.fetchDepSpy.firstCall.args[1]).to.equal(hostname);
            done();
          });
        });
      });
    });
    describe('getBackendFromUserMapping', function () {
      var testUser = 'mewtwo';
      beforeEach(function(done) {
        sinon.stub(ctx.user, 'fetchRoutes');
        assign(ctx.user.attrs, {
          accounts: {
            github: {
              username: testUser
            }
          }
        });
        done();
      });
      afterEach(function(done) {
        ctx.user.fetchRoutes.restore();
        done();
      });
      it('should callback error if fetchRoutes error', function (done) {
        var url = 'http://dat.url/path';
        var testErr = 'errrus';
        ctx.user.fetchRoutes.yields(testErr);
        ctx.user.getBackendFromUserMapping(url, function (err) {
          expect(err).to.equal(testErr);
          done();
        });
      });
      it('should 404 if no mapping returned', function (done) {
        var url = 'http://dat.url/path';
        ctx.user.fetchRoutes.yields(null, []);
        ctx.user.getBackendFromUserMapping(url, function (err) {
          expect(err.output.statusCode).to.equal(404);
          done();
        });
      });
      it('should return error if fetchInstances err', function (done) {
        var url = 'http://dat.url/path';
        var testErr = 'someErr';
        var testId = '792834659';
        ctx.user.fetchRoutes.yields(null, [{srcHostname: 'dat.url', destInstanceId: testId}]);
        ctx.user.fetchInstances.yields(testErr);
        ctx.user.getBackendFromUserMapping(url, function (err) {
          expect(err).to.equal(testErr);
          expect(ctx.user.fetchInstances.calledWith({
            _id: testId,
            githubUsername: testUser
          })).to.be.true();
          done();
        });
      });
      it('should return 404 if no instances', function (done) {
        var url = 'http://dat.url/path';
        var testId = '792834659';
        ctx.user.fetchRoutes.yields(null, [{srcHostname: 'dat.url', destInstanceId: testId}]);
        ctx.user.fetchInstances.yields(null, {models: []});
        ctx.user.getBackendFromUserMapping(url, function (err) {
          expect(err.output.statusCode).to.equal(404);
          expect(ctx.user.fetchInstances.calledWith({
            _id: testId,
            githubUsername: testUser
          })).to.be.true();
          done();
        });
      });
      it('should return host', function (done) {
        var url = 'http://dat.url/path';
        var testId = '792834659';
        var testHost = 'yes.com:1234';
        ctx.user.fetchRoutes.yields(null, [{srcHostname: 'dat.url', destInstanceId: testId}]);
        ctx.user.fetchInstances.yields(null, {models: [{
          attrs: {
            container: {
              inspect: {}
            }
          },
          dockerUrlForPort: function () { return testHost; }
        }]});
        ctx.user.getBackendFromUserMapping(url, function (err, host) {
          expect(host).to.equal(testHost);
          done();
        });
      });
    });

    describe('_fetchInstanceAndDepWithHostname', function () {

      it('should callback error if fetchInstances errors', function (done) {
        var query = {};
        var hostname = 'api-codenow.runnableapp.com';
        var instance = { fetchDependencies: sinon.spy() };
        var instances = [ instance ];
        var fetchErr = new Error();
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.user._fetchInstanceAndDepWithHostname(query, hostname, function (err) {
          expect(err).to.equals(fetchErr);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.equal(true);
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(fetchErr); // respond empty here.. use return value for expects
      });

      it('should callback 404 if instance not found', function (done) {
        var query = {};
        var hostname = 'api-codenow.runnableapp.com';
        var instances = [ ];
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.user._fetchInstanceAndDepWithHostname(query, hostname, function (err, dependency) {
          expect(err.output.statusCode).to.equal(404);
          expect(err.message).to.equal('referer instance not found');
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.equal(true);
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
      });

      it('should callback error if fetchDependencies errors', function (done) {
        var query = {};
        var hostname = 'api-codenow.runnableapp.com';
        var instance = { fetchDependencies: noop };
        var fetchDepsSpy = sinon.stub(instance, 'fetchDependencies');
        var instances = [ instance ];
        var fetchErr = new Error();
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.user._fetchInstanceAndDepWithHostname(query, hostname, function (err) {
          expect(err).to.equals(fetchErr);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.equal(true);
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        fetchDepsSpy
          .onCall(0)
          .returns({ models: [] });
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepsSpy.calledOnce).to.equal(true);
        expect(fetchDepsSpy.firstCall.args[0]).to.eql({
          hostname: hostname
        });
        var fetchDependenciesCb = last(fetchDepsSpy.firstCall.args);
        fetchDependenciesCb(fetchErr);
      });

      it('should callback dep[0] from fetchDependencies', function (done) {
        var query = {};
        var hostname = 'api-codenow.runnableapp.com';
        var instance = { fetchDependencies: noop };
        var fetchDepsSpy = sinon.stub(instance, 'fetchDependencies');
        var dependency = {};
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: [ instance ] });
        ctx.user._fetchInstanceAndDepWithHostname(query, hostname, function (err, dep, inst) {
          expect(err).to.not.exist();
          expect(dep).to.equal(dependency);
          expect(inst).to.equal(instance);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.equal(true);
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        fetchDepsSpy
          .onCall(0)
          .returns({ models: [ dependency ] });
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepsSpy.calledOnce).to.equal(true);
        expect(fetchDepsSpy.firstCall.args[0]).to.eql({
          hostname: hostname
        });
        var fetchDependenciesCb = last(fetchDepsSpy.firstCall.args);
        fetchDependenciesCb(null, []); // respond empty here.. use return value for expects
      });
    });
  });
});

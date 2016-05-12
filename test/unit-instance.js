/*global describe: true, beforeEach:true, afterEach:true, it:true */
/*jshint -W030 */
/**
 * @module test/unit-instance
 */
'use strict';
var expect = require('chai').expect;
var keypather = require('keypather')();
var last = require('101/last');
var noop = require('101/noop');
var put = require('101/put');
var sinon = require('sinon');

var Container = require('../lib/models/instance/container.js');
var ContextVersion = require('../lib/models/context/version');
var Instance = require('../lib/models/instance');
var User = require('../lib/models/user');
var collectionStore = require('../lib/stores/collection-store');
var modelStore = require('../lib/stores/model-store');

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

describe('instance model', function () {
  var ctx;
  beforeEach(function (done) {
    ctx = {};
    ctx.mockSocket = {
      on: sinon.stub(),
      off: sinon.stub(),
      onJoinRoom: sinon.stub().yieldsAsync(),
      offJoinRoom: sinon.stub()
    };
    ctx.instanceOpts = put(modelOpts, 'user', { socket: ctx.mockSocket });
    ctx.instance = new Instance({
      _id: '123456789012345678901234',
      shortHash: 'abcdef',
      owner: {
        github: 1,
        username: 'tjmehta'
      }
    }, ctx.instanceOpts);
    ctx.mockSocket.orgRoom = ctx.instance.attrs.owner.github;
    done();
  });

  describe('status', function () {
    it('should correctly return starting', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Starting: true
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        }
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('starting');
      done();
    });
    it('should correctly return stopping', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Stopping: true
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        }
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('stopping');
      done();
    });
    it('should correctly return stopped', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Running: false,
            ExitCode: 0
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        }
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('stopped');
      done();
    });

    it('should correctly return crashed', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Running: false,
            ExitCode: 1
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        }
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('crashed');
      done();
    });

    it('should correctly return neverStarted', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Running: false,
            ExitCode: 0,
            StartedAt: '0001-01-01T00:00:00Z'
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        }
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('neverStarted');
      done();
    });

    it('should correctly return running', function (done) {
      var container = new Container({
        inspect: {
          State: {
            Running: true,
            ExitCode: 0,
            StartedAt: new Date().toISOString()
          }
        }
      }, ctx.instanceOpts);
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        },
      }, ctx.instanceOpts);
      ctx.instance.containers = {
        models: [container]
      };
      var status = ctx.instance.status();
      expect(status).to.equal('running');
      done();
    });

    it('should correctly return buildFailed', function (done) {
      var instanceOpts = put({}, ctx.instanceOpts);
      instanceOpts.user = new User();
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        },
        contextVersion: {
          build: {
            completed: true,
            failed: true
          }
        }
      }, instanceOpts);
      var status = ctx.instance.status();
      expect(status).to.equal('buildFailed');
      done();
    });

    it('should correctly return building', function (done) {
      var instanceOpts = put({}, ctx.instanceOpts);
      instanceOpts.user = new User();
      ctx.instance = new Instance({
        _id: '123456789012345678901234',
        shortHash: 'abcdef',
        owner: {
          github: 1,
          username: 'tjmehta'
        },
        contextVersion: {
          build: {
            completed: false
          }
        }
      }, instanceOpts);
      var status = ctx.instance.status();
      expect(status).to.equal('building');
      done();
    });
  });

  describe('optimistic success starting/stopping states', function () {
    beforeEach(function (done) {
      keypather.set(ctx.instance, 'containers.models', [{
        attrs: {
          inspect: {State: {}}
        }
      }]);
      done();
    });
    it('should optimistically apply starting state', function (done) {
      ctx.instance.stop(noop);
      expect(ctx.instance.status()).to.equal('stopping');
      done();
    });
    it('should optimistically apply stopping state', function (done) {
      ctx.instance.start(noop);
      expect(ctx.instance.status()).to.equal('starting');
      done();
    });
  });

  describe('getContainerUrl', function () {
    describe('invalid container', function() {
      it('should return 504 if no container', function(done) {
        keypather.set(ctx.instance, 'attrs', '{}');
        ctx.instance.getContainerUrl(200, function (err) {
          expect(err.output.statusCode).to.equal(504);
          done();
        });
      });
      it('should return 504 if container error', function(done) {
        keypather.set(ctx.instance, 'attrs.container.error', 'sugar');
        ctx.instance.getContainerUrl(200, function (err) {
          expect(err.output.statusCode).to.equal(504);
          done();
        });
      });
      it('should return 503 if container inspect error', function(done) {
        keypather.set(ctx.instance, 'attrs.container.inspect.error', 'spice');
        ctx.instance.getContainerUrl(200, function (err) {
          expect(err.output.statusCode).to.equal(503);
          done();
        });
      });
    });
    describe('valid container', function() {
      beforeEach(function (done) {
        keypather.set(ctx.instance, 'attrs.container.inspect', 'everything nice');
        sinon.stub(ctx.instance, 'dockerUrlForPort');
        done();
      });
      afterEach(function (done) {
        ctx.instance.dockerUrlForPort.restore();
        done();
      });
      it('should return url', function(done) {
        var testUrl = 'http://ome-where-over-rainbow:6564';
        ctx.instance.dockerUrlForPort.returns(testUrl);
        ctx.instance.getContainerUrl(200, function (err, url) {
          expect(url).to.equal(testUrl);
          done();
        });
      });

      it('should return 400', function(done) {
        ctx.instance.dockerUrlForPort.returns(null);
        ctx.instance.getContainerUrl(100, function (err) {
          expect(err.output.statusCode).to.equal(400);
          done();
        });
      });
    });
  });

  describe('dockerUrlForPort', function () {
    it('should error if not passed a port', function (done) {
      var i = ctx.instance;
      try {
        i.dockerUrlForPort();
      }
      catch (e) {
        expect(e).to.be.ok();
        expect(e.message).to.ok();
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
        ctx.instance.extend(data);
        done();
      });

      it('should get the docker url', function (done) {
        expect(ctx.instance.dockerUrlForPort(ctx.exposedPort)).to.equal('http://10.0.1.10:49012/');
        done();
      });
    });
  });

  describe('genDeps', function () {
    beforeEach(function (done) {
      modelStore.enabled = true;
      collectionStore.enabled = true;
      userContentDomain = 'runnableapp.com';
      var githubUsername = 'tjmehta';
      var owner = { github: 1, username: githubUsername };
      ctx.user = new User({}, modelOpts);
      ctx.allInstancesByOwner = ctx.user.newInstances([
        {
          shortHash:'api',
          name: 'api',
          owner: owner
        },
        {
          shortHash:'web',
          name: 'web',
          owner: owner
        },
        {
          shortHash:'mongo',
          name: 'mongo',
          owner: owner
        }
      ], { qs: { githubUsername: githubUsername }, reset: true });
      ctx.instance = ctx.allInstancesByOwner.models[0];
      ctx.instance.extend({
        env: [
          'foo=http://web-'+githubUsername+'.'+userContentDomain,
          'bar=mongo-'+githubUsername+'.'+userContentDomain,
          'qux=api-'+githubUsername+'.'+userContentDomain
        ]
      });
      done();
    });
    afterEach(function (done) {
      modelStore.enabled = false;
      collectionStore.enabled = false;
      done();
    });

    it('should generate deps from env and instances', function (done) {
      expect(ctx.instance.dependencies.models.length).to.equal(2);
      expect(ctx.instance.dependencies.models).to.contain(ctx.allInstancesByOwner.models[1]);
      expect(ctx.instance.dependencies.models).to.contain(ctx.allInstancesByOwner.models[2]);
      done();
    });
  });

  describe('Instances Names', function () {
    var instance;
    var githubUsername = 'tjmehta';
    var branchName = 'branch-name';
    var repoName = 'repo-name';
    var acv;
    beforeEach(function setup () {
      acv = {
        _id: 3,
        repo: githubUsername + '/' + repoName,
        branch: branchName
      };
      var owner = { github: 1, username: githubUsername };
      ctx.instanceOpts.user = new User({}, modelOpts);
      instance = new Instance({
        _id: 0,
        shortHash: 'abcdef',
        name: 'instanceName', // masterPod instances name do not include branch
        owner: owner,
        masterPod: true,
        contextVersion: {
          _id: 1,
          context: '1234',
          appCodeVersions: [acv, {
            _id: 2,
            additionalRepo: true,
            repo: githubUsername + '/' + repoName,
            branch: branchName + '2'
          }]
        }
      }, ctx.instanceOpts);
    });

    describe('getBranchName', function () {
      it('should get the branch name', function () {
        expect(instance.getBranchName()).to.equal(branchName);
      });
      it('should be null if it doesnt exist', function () {
        delete instance.contextVersion.appCodeVersions.models[0].attrs.branch;
        expect(instance.getBranchName()).to.equal(undefined);
      });
    });

    describe('getRepoName', function () {
      it('should get the repo name', function () {
        expect(instance.getRepoName()).to.equal(repoName);
      });
      it('should be null if it doesnt exist', function () {
        delete instance.contextVersion.appCodeVersions.models[0].attrs.repo;
        expect(instance.getRepoName()).to.equal(undefined);
      });
    });

    describe('getDisplayName', function () {
      beforeEach(function () {
        sinon.stub(instance, 'getBranchName').returns(null);
      });
      afterEach(function () {
        instance.getBranchName.restore();
      });
      it('should return branch name if not master pod', function (done) {
        instance.getBranchName.returns('foo');
        instance.attrs.masterPod = false;
        expect(instance.getDisplayName()).to.equal('foo');
        done();
      });
      it('should return name if master pod', function (done) {
        instance.attrs.masterPod = true;
        instance.getBranchName.returns('foo');
        expect(instance.getDisplayName()).to.equal('instanceName');
        done();
      });
      it('should return truncated name if name is isolated', function (done) {
        instance.attrs.name = 'ShHash--TestName';

        expect(instance.getDisplayName()).to.equal('TestName');
        done();
      });
    });

    describe('getRepoAndBranchName', function () {
      beforeEach(function () {
        sinon.stub(instance, 'getBranchName').returns('branch');
        sinon.stub(instance, 'getRepoName').returns('repo');
      });
      afterEach(function () {
        instance.getBranchName.restore();
        instance.getRepoName.restore();
      });
      it('should return repo and branch name if they exist', function (done) {
        expect(instance.getRepoAndBranchName()).to.equal('repo/branch');
        done();
      });
      it('should return name if branch name does not exist', function (done) {
        instance.getBranchName.returns(null);
        expect(instance.getRepoAndBranchName()).to.equal('instanceName');
        done();
      });
      it('should return name if repo name does not exist', function (done) {
        instance.getRepoName.returns(null);
        expect(instance.getRepoAndBranchName()).to.equal('instanceName');
        done();
      });
      it('should return truncated name if name is isolated', function (done) {
        instance.getBranchName.returns(null);
        instance.getRepoName.returns(null);
        instance.attrs.name = 'ShHash--TestName';
        expect(instance.getRepoAndBranchName()).to.equal('TestName');
        done();
      });
    });

    describe('getName', function () {
      it('should return the instance name', function () {
        expect(instance.getName()).to.equal('instanceName');
      });
      it('should return the instance name when its in isolation', function () {
        instance.attrs.name = '2gkj3l--instanceName';
        expect(instance.getName()).to.equal('instanceName');
      });
      it('should return the instance name when it almost looks like in isolation', function () {
        instance.attrs.name = '2gkj3l-instanceName';
        expect(instance.getName()).to.equal('2gkj3l-instanceName');
      });
    });

    describe('getMasterPodName', function () {
      beforeEach(function () {
        sinon.stub(instance, 'getBranchName').returns('master');
        sinon.stub(instance, 'getName').returns('repo-name');
      });
      afterEach(function () {
        instance.getBranchName.restore();
        instance.getName.restore();
      });
      it('should handle the default master pod name', function () {
        expect(instance.getMasterPodName()).to.equal('repo-name');
      });
      it('should handle the name having a branch name', function () {
        instance.getBranchName.returns('branch-name');
        instance.getName.returns('branch-name-super-repo-name');
        expect(instance.getMasterPodName()).to.equal('super-repo-name');
      });
      it('should handle the branch and repo being name the same way', function () {
        instance.getBranchName.returns('wow');
        instance.getName.returns('wow-wow');
        expect(instance.getMasterPodName()).to.equal('wow');
      });
    });

    describe('getInstanceAndBranchName', function () {
      beforeEach(function () {
        sinon.stub(instance, 'getBranchName').returns('wow');
        sinon.stub(instance, 'getName').returns('repo-name');
      });
      afterEach(function () {
        instance.getBranchName.restore();
        instance.getName.restore();
      });
      it('should only return the instance name if there is no branch', function () {
        instance.getBranchName.returns(null);
        expect(instance.getInstanceAndBranchName()).to.equal('repo-name');
      });
      it('should return the instance name with the branch name if there is a branch', function () {
        expect(instance.getInstanceAndBranchName()).to.equal('repo-name/wow');
      });
    });
  });

  describe('URL generation', function () {
    var instance, instance2;
    var githubUsername = 'tjmehta';
    var branchName = 'branch-name';
    var repoName = 'repo-name';
    beforeEach(function (done) {
      var owner = { github: 1, username: githubUsername };
      ctx.instanceOpts.user = new User({}, modelOpts);
      instance = new Instance({
        _id: 0,
        shortHash: 'abcdef',
        name: 'instanceName', // masterPod instances name do not include branch
        owner: owner,
        masterPod: true,
        contextVersion: {
          _id: 1,
          context: '1234',
          appCodeVersions: [{
            _id: 3,
            additionalRepo: true,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2'
          }, {
            _id: 2,
            repo: githubUsername + '/' + repoName,
            branch: branchName
          }]
        }
      }, ctx.instanceOpts);

      done();
    });

    it('should return the branch name', function () {
      expect(instance.getBranchName()).to.equal(branchName);
    });

    it('should return the repo name', function () {
      expect(instance.getRepoName()).to.equal(repoName);
    });

    it('should return the repo/branch name', function () {
      expect(instance.getRepoAndBranchName()).to.equal(repoName + '/' + branchName);
    });

    describe('getContainerHostname', function() {

      it('should get the container host', function () {
        var hostname = instance.attrs.shortHash + '-' + instance.attrs.name;
        hostname += '-staging-' + githubUsername + '.' + userContentDomain;
        expect(instance.getContainerHostname())
          .to.equal((hostname).toLowerCase());
      });

      describe('masterPod w/out branch', function () {
        beforeEach(function (done) {
          var owner = { github: 1, username: githubUsername };
          instance2 = new Instance({
            _id: 0,
            shortHash: 'abcdef',
            name: 'instanceName', // masterPod instances name do not include branch
            owner: owner,
            masterPod: true,
            contextVersion: {
              _id: 1,
              context: '1234',
              appCodeVersions: []
            }
          }, ctx.instanceOpts);

          done();
        });
        it('should return the instance name (since it doesnt have a branch)', function () {
          expect(instance2.getRepoAndBranchName()).to.equal(instance2.attrs.name);
        });
        it('should get the container host', function (done) {
          var hostname = instance2.attrs.name + '-staging-';
          hostname += githubUsername + '.' + userContentDomain;
          expect(instance2.getContainerHostname())
            .to.equal((hostname).toLowerCase());
          done();
        });
      });
    });

    it('should get the elastic host', function () {
      var hostname = instance.attrs.name + '-staging-' + githubUsername + '.' + userContentDomain;
      expect(instance.getElasticHostname())
        .to.equal((hostname).toLowerCase());
    });
  });

  /**
   * What to test
   *
   * Everything the same (except ACV), should return true
   * Envs differ
   * Dockerfiles differ
   * Master has extra build files
   * Master has 1 build file that has been changed
   */
  describe('getParentConfigStatus', function () {
    describe('is Master', function () {
      it('should return true when instance is masterpod', function () {
        ctx.instance.attrs.masterPod = true;
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.true;
        });
      });
    });
    describe('is not Master', function () {
      var githubUsername = 'tjmehta';
      var branchName = 'branch-name';
      var repoName = 'repo-name';
      var owner = { github: 1, username: githubUsername };
      beforeEach(function (done) {
        ctx.user = new User({}, modelOpts);
        ctx.masterInstanceCollection = ctx.user.newInstances(
          [ {
            shortHash:'api',
            name: 'api',
            owner: owner
          } ],
          { qs: { githubUsername: githubUsername }, reset: true }
        );
        ctx.masterInstance = ctx.masterInstanceCollection.models[0];
        ctx.instance.contextVersion = new ContextVersion({
          _id: 1,
          context: '1234',
          appCodeVersions: [{
            _id: 3,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2',
            lowerBranch: branchName + '2'
          }]
        }, modelOpts);
        ctx.masterInstance.contextVersion = new ContextVersion({
          _id: 1,
          context: '1234',
          appCodeVersions: [{
            _id: 3,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2',
            lowerBranch: branchName + '2'
          }]
        }, modelOpts);
        ctx.instance.contextVersion.rootDir.contents.fetch = sinon.stub().yieldsAsync();
        ctx.masterInstance.contextVersion.rootDir.contents.fetch =
            sinon.stub().yieldsAsync();

        done();
      });
      beforeEach(function (done) {
        ctx.instance.user.fetchInstances = sinon.stub()
          .returns(ctx.masterInstanceCollection)
          .yieldsAsync(
            null,
            ctx.masterInstanceCollection
          );
        done();
      });
      it('should return true when they are basically the same', function (done) {
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.true;
          done();
        });
      });

      it('should return false when their files are the same', function (done) {
        ctx.masterInstance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'adsfasdfadsfsadf'
        });
        ctx.instance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'adsfasdfadsfsadf'
        });
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.true;
          done();
        });
      });

      it('should return false when their envs are out of sync', function (done) {
        ctx.masterInstance.attrs.env = ['fsadfasdfads', 'asdfadsf'];
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.false;
          done();
        });
      });

      it('should return false when their transformRules are out of sync', function (done) {
        ctx.masterInstance.contextVersion.appCodeVersions.models[0].attrs.transformRules = {
          exclude: ['asdfasdfads'],
          replace: {
            to: 'sdfadsf',
            from: 'adsfsdfadsf'
          }
        };
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.false;
          done();
        });
      });

      it('should return false when their file counts are out of sync', function (done) {
        ctx.masterInstance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'adsfasdfadsfsadf'
        });
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.false;
          done();
        });
      });

      it('should return false when their files are different', function (done) {
        ctx.masterInstance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'adsfasdfadsfsadf'
        });
        ctx.instance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'dfhgdfhdsfghadfsgsdf'
        });
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.false;
          done();
        });
      });
      it('should return false first, then again when cache is valid, then true when invalidated',
          function (done) {
        ctx.masterInstance.contextVersion.rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt',
          hash: 'adsfasdfadsfsadf'
        });
        ctx.instance.fetchParentConfigStatus(function () {
          expect(ctx.instance.configStatusValid).to.be.true;
          expect(ctx.instance.cachedConfigStatus).to.be.false;

          ctx.instance.contextVersion.rootDir.contents.add({
            name: 'file.txt',
            path: '/',
            Key: '/instanceId/source/file.txt',
            hash: 'adsfasdfadsfsadf'
          });
          ctx.instance.fetchParentConfigStatus(function () {
            expect(ctx.instance.configStatusValid).to.be.true;
            expect(ctx.instance.cachedConfigStatus).to.be.false;
            ctx.instance.configStatusValid = false;
            ctx.instance.fetchParentConfigStatus(function () {
              expect(ctx.instance.configStatusValid).to.be.true;
              expect(ctx.instance.cachedConfigStatus).to.be.true;
              done();
            });
          });
        });
      });
    });
  });

  describe('socket events', function () {

    describe('update events', function() {
      it('should emit updated', function (done) {
        expect(ctx.mockSocket.onJoinRoom.calledOnce).to.be.true;
        expect(ctx.mockSocket.on.calledOnce).to.be.true;
        modelStore.once('model:update:socket', function () {
          done();
        });
        var dataHandler = last(ctx.mockSocket.on.firstCall.args);
        dataHandler({
          data: {
            event: 'INSTANCE_UPDATE',
            action: 'update',
            data: put(ctx.instance.json(), 'masterPod', true)
          }
        });
      });
    });
    describe('cv update events', function() {
      var githubUsername = 'tjmehta';
      var branchName = 'branch-name';
      var repoName = 'repo-name';

      beforeEach(function (done) {
        var myModelOpts = put(modelOpts, 'user.socket', ctx.mockSocket);
        ctx.instance.contextVersion = new ContextVersion({
          _id: 1,
          context: '1234',
          appCodeVersions: [{
            _id: 3,
            additionalRepo: true,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2',
            lowerBranch: branchName + '2'
          }, {
            _id: 2,
            repo: githubUsername + '/' + repoName,
            branch: branchName,
            lowerBranch: branchName
          }]
        }, myModelOpts);
        done();
      });
      it('should set the backgroundUpdating to be true when the cv updates', function (done) {
        expect(ctx.mockSocket.onJoinRoom.calledOnce).to.be.true;
        expect(ctx.mockSocket.on.calledOnce).to.be.true;

        var mockBuildInfo = {
          someInfo: 'hello'
        };
        modelStore.once('model:update:socket', function () {
          expect(ctx.instance.backgroundContextVersionBuilding).to.equal(mockBuildInfo);
          expect(ctx.instance.backgroundContextVersionFinished).to.be.false;
          done();
        });
        var dataHandler = last(ctx.mockSocket.on.lastCall.args);
        dataHandler({
          data: {
            event: 'CONTEXTVERSION_UPDATE',
            action: 'build_started',
            data: put(ctx.instance.contextVersion.json(), 'build', mockBuildInfo)
          }
        });
      });
      it('should set the backgroundFinished to be true when the cv finishes', function (done) {
        expect(ctx.mockSocket.onJoinRoom.calledOnce).to.be.true;
        expect(ctx.mockSocket.on.calledOnce).to.be.true;

        var mockBuildInfo = {
          someInfo: 'cheese'
        };
        modelStore.once('model:update:socket', function () {
          expect(ctx.instance.backgroundContextVersionFinished).to.equal(mockBuildInfo);
          expect(ctx.instance.backgroundContextVersionBuilding).to.be.false;
          done();
        });
        var dataHandler = last(ctx.mockSocket.on.lastCall.args);
        dataHandler({
          data: {
            event: 'CONTEXTVERSION_UPDATE',
            action: 'build_completed',
            data: put(ctx.instance.contextVersion.json(), 'build', mockBuildInfo)
          }
        });
      });
      it('should ignore messages from different cvs', function (done) {
        var myModelOpts = put(modelOpts, 'user.socket', ctx.mockSocket);
        var differentCV = new ContextVersion({
          _id: 2345234,
          context: '34562345623456',
          appCodeVersions: [{
            _id: 3,
            additionalRepo: true,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2',
            lowerBranch: branchName + '2'
          }, {
            _id: 2,
            repo: githubUsername + '/' + repoName,
            branch: branchName,
            lowerBranch: branchName
          }]
        }, myModelOpts);
        expect(ctx.mockSocket.onJoinRoom.calledOnce).to.be.true;
        expect(ctx.mockSocket.on.calledOnce).to.be.true;

        var mockBuildInfo = {
          someInfo: 'cheese'
        };
        setTimeout(function () {
          expect(ctx.instance.backgroundContextVersionFinished).to.be.false;
          expect(ctx.instance.backgroundContextVersionBuilding).to.be.false;
          done();
        }, 100);
        var dataHandler = last(ctx.mockSocket.on.lastCall.args);
        dataHandler({
          data: {
            event: 'CONTEXTVERSION_UPDATE',
            action: 'build_started',
            data: put(differentCV.json(), 'build', mockBuildInfo)
          }
        });
      });
      it('should ignore messages from cvs with different masterAcvs branches', function (done) {
        var myModelOpts = put(modelOpts, 'user.socket', ctx.mockSocket);
        var differentCV = new ContextVersion({
          _id: 1,
          context: '1234',
          appCodeVersions: [{
            _id: 3,
            additionalRepo: true,
            repo: githubUsername + '/' + repoName + '2',
            branch: branchName + '2',
            lowerBranch: branchName + '2'
          }, {
            _id: 2,
            repo: githubUsername + '/' + repoName,
            branch: branchName + '/asdfsadfasdf',
            lowerBranch: branchName + '/asdfsadfasdf'
          }]
        }, myModelOpts);
        expect(ctx.mockSocket.onJoinRoom.calledOnce).to.be.true;
        expect(ctx.mockSocket.on.calledOnce).to.be.true;

        var mockBuildInfo = {
          someInfo: 'cheese'
        };
        setTimeout(function () {
          expect(ctx.instance.backgroundContextVersionFinished).to.be.false;
          expect(ctx.instance.backgroundContextVersionBuilding).to.be.false;
          done();
        }, 100);
        var dataHandler = last(ctx.mockSocket.on.lastCall.args);
        dataHandler({
          data: {
            event: 'CONTEXTVERSION_UPDATE',
            action: 'build_completed',
            data: put(differentCV.json(), 'build', mockBuildInfo)
          }
        });
      });
    });
  });

  describe('isMigrating', function () {
    beforeEach(function (done) {
      sinon.stub(ctx.instance, 'status').returns(false)
      done()
    })
    afterEach(function (done) {
      ctx.instance.status.restore()
      done()
    })
    describe('when dockRemoved is true', function () {
      beforeEach(function (done) {
        keypather.set(ctx.instance, 'contextVersion.attrs.dockRemoved', true)
        done()
      })
      var testMapping = {
        starting: true,
        stopping: false,
        stopped: false,
        crashed: false,
        running: true,
        neverStarted: true,
        buildFailed: false,
        building: true,
        unknown: true
      }

      Object.keys(testMapping).forEach(function (key) {
        describe('when status is ' + key, function () {
          beforeEach(function (done) {
            ctx.instance.status.returns(key)
            done()
          })
          it('should return ' + testMapping[key], function (done) {
            expect(ctx.instance.isMigrating()).to.equal(testMapping[key])
            done()
          });
        })
      })

    })
    describe('when dockRemoved is false', function () {
      beforeEach(function (done) {
        keypather.set(ctx.instance, 'contextVersion.attrs.dockRemoved', false)
        done()
      })

      var testMapping = {
        starting: false,
        stopping: false,
        stopped: false,
        crashed: false,
        running: false,
        neverStarted: false,
        buildFailed: false,
        building: false,
        unknown: false
      }

      Object.keys(testMapping).forEach(function (key) {
        describe('when status is ' + key, function () {
          beforeEach(function (done) {
            ctx.instance.status.returns(key)
            done()
          })
          it('should return ' + testMapping[key], function (done) {
            expect(ctx.instance.isMigrating()).to.equal(testMapping[key])
            done()
          });
        })
      })
    })
  })
});

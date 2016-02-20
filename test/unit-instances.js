var expect = require('chai').expect;
var noop = require('101/noop');
var last = require('101/last');
var put = require('101/put');
var Instances = require('../lib/collections/instances');
var collectionStore = require('../lib/stores/collection-store');
var sinon = require('sinon');

var mockClient = {
  post: noop,
  patch: noop,
  del: noop
};
var userContentDomain = 'runnableapp.com';
var modelOpts = {
  client: mockClient,
  userContentDomain: userContentDomain
};

describe('instances model', function () {
  var ctx;
  beforeEach(function (done) {
    ctx = {};
    ctx.mockSocket = {
      on: sinon.stub(),
      off: sinon.stub(),
      onJoinRoom: sinon.stub().yieldsAsync(),
      offJoinRoom: sinon.stub()
    };
    ctx.instanceOpts = put(modelOpts, {
      'user': { socket: ctx.mockSocket },
      'qs'  : { githubUsername: 'tjmehta' }
    });
    ctx.instances = new Instances([{
      _id: '123456789012345678901234',
      shortHash: 'abcdef',
      owner: {
        github: 1,
        username: 'tjmehta'
      }
    }], ctx.instanceOpts);
    ctx.mockSocket.orgRoom = ctx.instances.models[0].attrs.owner.github;
    done();
  });

  describe('socket events', function () {
    describe('create events', function() {
      it('should emit add', function (done) {
        sinon.assert.callCount(ctx.mockSocket.on, 3);
        collectionStore.on('collection:update:socket', function () {
          done();
        });
        var newInstance = put(ctx.instances.models[0].json(), {
          _id: '111112222233333444445555',
          shortHash: 'aaaaaa'
        });
        var dataHandlers = [
          last(ctx.mockSocket.on.firstCall.args),
          last(ctx.mockSocket.on.secondCall.args)
        ];
        dataHandlers.forEach(function (handler) {
          handler({
            data: {
              event: 'INSTANCE_UPDATE',
              action: 'post',
              data: newInstance
            }
          });
        });
      });
    });
  });
});

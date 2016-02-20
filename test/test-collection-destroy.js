var User = require('../index');
var expect = require('chai').expect;
var noop = require('101/noop');
var Model = require('../lib/models/base');
var Collection = require('../lib/collections/base');
var mockClient = {
  post: noop,
  patch: noop,
  del: noop
};
var modelOpts = {
  client: mockClient
};
function collectionOpts (qs) {
  var opts = {};
  opts.qs = qs;
  opts.client = mockClient;
  return opts;
}

describe('collection destroy', function () {
  var ctx = {};
  before(function (done) {
    Model.prototype.urlPath = 'path';
    done();
  });
  after(function (done) {
    delete Model.prototype.urlPath;
    done();
  });
  before(function (done) {
    Model.prototype.urlPath = 'path';
    Collection.prototype.urlPath = 'path';
    Collection.prototype.Model = Model;
    done();
  });
  after(function (done) {
    delete Model.prototype.urlPath;
    delete Collection.prototype.urlPath;
    delete Collection.prototype.Model;
    done();
  });
  beforeEach(function (done) {
    ctx.model = new Model({ _id: '1' }, modelOpts);
    ctx.collection = new Collection([ ctx.model ], collectionOpts());
    done();
  });
  afterEach(function (done) {
    ctx = {};
    done();
  });
  it('should destroy a model and assume success', function (done) {
    ctx.collection.destroy(ctx.model, noop);
    expect(ctx.collection.models.length).to.equal(0);
    done();
  });
  it('should destroy a model and revert on error', function (done) {
    ctx.model.client.del = function (url, opts, cb) {
      cb(new Error());
    };
    ctx.collection.destroy(ctx.model, noop);
    expect(ctx.collection.models.length).to.equal(1);
    done();
  });
});
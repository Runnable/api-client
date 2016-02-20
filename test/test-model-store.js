var User = require('../index');
var expect = require('chai').expect;
var modelStore = require('../lib/stores/model-store');
var collStore = require('../lib/stores/collection-store');
var Model = require('../lib/models/base');
var Collection = require('../lib/collections/base');
var modelOpts = {
  client: true,
};
function collectionOpts (qs) {
  var opts = {};
  opts.qs = qs;
  opts.client = true;
  return opts;
}

describe('model store', function () {
  var ctx = {};
  before(function (done) {
    modelStore.enabled = true; // override serverside behavior
    Model.prototype.urlPath = 'path';
    done();
  });
  after(function (done) {
    modelStore.enabled = false; // reset serverside behavior
    delete Model.prototype.urlPath;
    done();
  });
  beforeEach(function (done) {
    ctx.model1 = new Model({ _id: 1 }, modelOpts);
    ctx.model2 = new Model({ _id: 2 }, modelOpts);
    ctx.model3 = new Model({ _id: 3 }, modelOpts);
    ctx.altModel1 = new Model({ _id: 1 }, modelOpts);
    done();
  });
  afterEach(function (done) {
    ctx = {};
    modelStore.reset();
    done();
  });
  it('should add a model', function (done) {
    modelStore.add(ctx.model1);
    done();
  });
  it('should get a model', function (done) {
    modelStore.check(ctx.model1);
    expect(modelStore.get(ctx.model1))
      .to.equal(ctx.model1);
    done();
  });
  it('should check if a model is a duplicate', function (done) {
    modelStore.check(ctx.model1);
    expect(modelStore.check(ctx.altModel1))
      .to.equal(ctx.model1);
    done();
  });
});

describe('collection store', function () {
  var ctx = {};
  before(function (done) {
    modelStore.enabled = true; // override serverside behavior
    Model.prototype.urlPath = 'path';
    collStore.enabled = true; // override serverside behavior
    Collection.prototype.urlPath = 'path';
    Collection.prototype.Model = Model;
    done();
  });
  after(function (done) {
    modelStore.enabled = false; // reset serverside behavior
    delete Model.prototype.urlPath;
    collStore.enabled = false; // reset serverside behavior
    delete Collection.prototype.urlPath;
    delete Collection.prototype.Model;
    done();
  });
  beforeEach(function (done) {
    // models
    ctx.model1 = new Model({ _id: 1 }, modelOpts);
    ctx.model2 = new Model({ _id: 2 }, modelOpts);
    ctx.model3 = new Model({ _id: 3 }, modelOpts);
    ctx.altModel1 = new Model({ _id: 1 }, modelOpts);
    ctx.altModel2 = new Model({ _id: 2 }, modelOpts);
    // collections
    ctx.coll1 = new Collection([], collectionOpts({ path: 1 }));
    ctx.coll2 = new Collection([], collectionOpts({ path: 2 }));
    ctx.coll3 = new Collection([], collectionOpts({ path: 3 }));
    ctx.altColl1 = new Collection([], collectionOpts({ path: 1 }));
    ctx.altColl2 = new Collection([], collectionOpts({ path: 2 }));
    done();
  });
  afterEach(function (done) {
    ctx = {};
    modelStore.reset();
    collStore.reset();
    done();
  });
  it('should should add a model', function (done) {
    ctx.coll1.add(ctx.model1);
    collStore.add(ctx.coll1);
    done();
  });
  it('should get a collection and model', function (done) {
    ctx.coll1.add(ctx.model1);
    collStore.add(ctx.coll1);
    expect(collStore.get(ctx.coll1))
      .to.equal(ctx.coll1);
    expect(modelStore.get(ctx.model1))
      .to.equal(ctx.model1);
    done();
  });
});
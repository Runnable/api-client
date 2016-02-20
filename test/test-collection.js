var expect = require('chai').expect;
var noop = require('101/noop');
var last = require('101/last');
var omit = require('101/omit');
var Model = require('../lib/models/base');
var Collection = require('../lib/collections/base');
var modelStore = require('../lib/stores/model-store');
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

describe('collection', function () {
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
    ctx.collection = new Collection([ ], collectionOpts());
    done();
  });
  afterEach(function (done) {
    ctx = {};
    done();
  });
  describe('add', function () {
    it('should add a model to the collection', function (done) {
      var model = ctx.model = new Model({ _id: '1' }, modelOpts);
      ctx.collection.add(model);
      expect(ctx.collection.models.length).to.equal(1);
      expect(ctx.collection.models[0]).to.equal(model);
      expect(ctx.collection.modelsHash[model.id()]).to.equal(model);
      done();
    });
    describe('readd', function() {
      beforeEach(function (done) {
        var model = ctx.model = new Model({ _id: '1' }, modelOpts);
        ctx.collection.add(model);
        expect(ctx.collection.models.length).to.equal(1);
        expect(ctx.collection.models[0]).to.equal(model);
        expect(ctx.collection.modelsHash[model.id()]).to.equal(model);
        done();
      });
      it('should not not add the same model again', function (done) {
        var model = ctx.model;
        ctx.collection.add(model);
        expect(ctx.collection.models.length).to.equal(1);
        expect(ctx.collection.models[0]).to.equal(model);
        expect(ctx.collection.modelsHash[model.id()]).to.equal(model);
        done();
      });
      it('should not not add the same model again (data)', function (done) {
        var data = ctx.model.toJSON();
        ctx.collection.add(data);
        expect(ctx.collection.models.length).to.equal(1);
        expect(ctx.collection.models[0]).to.equal(ctx.model);
        expect(ctx.collection.modelsHash[ctx.model.id()]).to.equal(ctx.model);
        done();
      });
    });
  });
  describe('create', function () {
    beforeEach(function (done) {
      modelStore.reset();
      modelStore.enabled = true;
      var resp = ctx.resp = {
        statusCode: 201,
        body: { _id: '1', name: 'foo' }
      };
      ctx.origCreate = Model.prototype.create;
      Model.prototype.create = function () {
        var self = this;
        var cb = last(arguments);
        setTimeout(function () { // make it async
          self.reset(resp.body);
          cb(null, resp.body, resp.statusCode, 200, resp);
        }, 10);
      };
      done();
    });
    afterEach(function (done) {
      modelStore.enabled = false;
      Model.prototype.create = ctx.origCreate;
      done();
    });
    it('should add a model to the collection', function (done) {
      var resp = ctx.resp;
      ctx.collection.create(resp.body, function () {
        expect(ctx.collection.models.length).to.equal(1);
        expect(ctx.collection.models[0].toJSON()).to.eql(resp.body);
        expect(ctx.collection.modelsHash[resp.body._id].toJSON()).to.eql(resp.body);
        done();
      });
    });
    it('should not create a duplicates for add while creating (w/out id) race', function (done) {
      var createBody = omit(ctx.resp.body, '_id');
      var model;
      ctx.collection.create(createBody, function () {
        // setTimeout gives time to dedupe the collection
        // model2.uid = '2'; // help for debug
        setTimeout(function () {
          expect(ctx.collection.models.length).to.equal(1);
          expect(ctx.collection.models[0].id()).to.equal(model.id());
          expect(ctx.collection.modelsHash[model.id()].id()).to.equal(model.id());
          // make sure hash and array match
          expect(ctx.collection.modelsHash[model.id()]).to.equal(ctx.collection.models[0]);
          done();
        }, 10);
      });
      model = new Model(ctx.resp.body, modelOpts);
      // model.uid = '1'; // help for debug
      modelStore.check(model);
      ctx.collection.add(model);
    });
  });
});
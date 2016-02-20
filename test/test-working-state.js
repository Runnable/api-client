var http = require('http');
var util = require('util');
var extend = require('extend');
var expect = require('chai').expect;
var exists = require('101/exists');
var isObject = require('101/is-object');
var isString = require('101/is-string');
var User = require('../index');
var Model = require('../lib/models/base');
var BaseFile = require('../lib/models/base-file');
var ApiClient = require('../lib/api-client');

describe('model working state', function() {
  var defaultOptions = { client: true };

  before(function(done) {
    Model.prototype.urlPath = 'path';
    done();
  });

  after(function(done) {
    delete Model.prototype.urlPath;
    done();
  });

  describe('resetState', function() {
    var model, newState;

    beforeEach(function(done) {
      var state = { a: 20, b: { c: 'hello' } };
      newState = { c: 30, d: 'ten', f: { cool: 'wow' } };
      model = new Model(state, defaultOptions);
      done();
    });

    it('should fully clear the state when given no arguments', function(done) {
      model.resetState();
      expect(model._state).to.deep.equal({});
      done();
    });

    it('should correctly set the state when given a state as an argument', function(done) {
      model.resetState(newState);
      expect(model._state).to.deep.equal(newState);
      done();
    });
  });

  describe('saveState', function() {
    var attrs, state, model, modelWithState, modelSemanticallySame;

    before(function(done) {
      attrs = { alpha: '&alpha;', beta: '&gamma', untouched: { wow: 'super' }};
      state = { beta: '&beta', other: { wow: 'neat' } };
      model = new Model(attrs, defaultOptions);
      modelWithState = new Model(attrs, defaultOptions);
      modelWithState._state = state;
      modelSemanticallySame = new Model(attrs, defaultOptions);
      modelSemanticallySame._state = { alpha: '&alpha;', untouched: { wow: 'super' }};
      done();
    });

    it('should save the state to attributes when called', function(done) {
      modelWithState.saveState();
      for (var key in state) {
        expect(modelWithState.attrs[key]).to.deep.equal(state[key]);
      }
      expect(modelWithState.attrs.alpha).to.deep.equal(attrs.alpha);
      expect(modelWithState.attrs.untouched).to.deep.equal(attrs.untouched);
      done();
    });

    it('should have no effect if there are no changes', function (done) {
      model.saveState();
      expect(model.attrs).to.deep.equal(attrs);
      done()
    });

    it('should have no effect if there are no semantic state changes', function(done) {
      modelSemanticallySame.saveState();
      expect(model.attrs).to.deep.equal(attrs);
      done();
    });

    it('should reset the state after saving', function(done) {
      expect(modelWithState._state).to.deep.equal({});
      expect(modelSemanticallySame._state).to.deep.equal({});
      done();
    });
  });

  describe('isDirty', function() {
    var clean, dirty;

    before(function(done) {
      var attrs = {a: 20, b: { c: 10, d: 'hello' }},
        state = {b: { d: 30 }};
      clean = new Model(attrs, defaultOptions);
      dirty = new Model(attrs, defaultOptions);
      dirty._state = state;
      done();
    });

    it('should correctly identify a clean model', function (done) {
      expect(clean.isDirty()).to.be.false;
      done();
    });

    it('should correctly identify a dirty model', function (done) {
      expect(dirty.isDirty()).to.be.true;
      done();
    });
  });

  describe('setState', function() {
    var model;

    beforeEach(function(done) {
      model = new Model({ a: 0, b: 1, c: { d: 10 }}, defaultOptions);
      done();
    });

    it('should set the appropriate state value', function(done) {
      model.setState('a', 'foo');
      expect(model._state.a).to.equal('foo')
      done();
    });

    it('should set the appropriate value for a full keypath', function(done) {
      model.setState('c.d', 'bar')
      expect(model._state.c).to.be.an('object');
      expect(model._state.c.d).to.equal('bar');
      done();
    });
  });

  describe('getState', function() {
    var model;

    before(function(done) {
      var attrs = { a: 'a', b: 'b', c: { d: 'd' }, e: { f: 'f' }},
        state = { a: 'aye', c: { d: 'dye' }};
      model = new Model(attrs, defaultOptions);
      model._state = state;
      done();
    });

    it('should return a value that is in the state', function(done) {
      expect(model.getState('a')).to.equal('aye');
      done();
    });

    it('should return a value in the state with a full key path', function(done) {
      expect(model.getState('c.d')).to.equal('dye');
      done();
    });

    it('should return undefined when the keypath is not in the state', function (done) {
      expect(model.getState('catwoman')).to.be.undefined;
      done();
    });
  });

  describe('hasState', function() {
    var model;

    before(function(done) {
      var attrs = { a: 20, b: { c: 30 } },
        state = { e: 40, f: { g: 50 } };
      model = new Model(attrs, defaultOptions);
      model._state = state;
      done();
    });

    it('should correctly determine if the state has a key', function (done) {
      expect(model.hasState('a')).to.be.false;
      expect(model.hasState('e')).to.be.true;
      expect(model.hasState('b.c')).to.be.false;
      expect(model.hasState('f.g')).to.be.true;
      done();
    });
  });
});

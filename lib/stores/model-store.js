'use strict';

var util = require('util');
var Base = require('./base');
var exists = require('101/exists');
var isString = require('101/is-string');
var consoleWarn = require('../console-warn');

function ModelStore (opts) {
  Base.call(this, opts);
  this.setMaxListeners(500);
  this.remove = this.remove.bind(this);
}

util.inherits(ModelStore, Base);

ModelStore.prototype.getKeyForModel = function (model) {
  if (model.noStore) { return; }
  var key = model.path().toLowerCase();
  return key;
};

ModelStore.prototype.add = function (model) {
  if (model.noStore) { return; }
  var key = this.getKeyForModel(model);

  return Base.prototype.set.call(this, key, model);
};

ModelStore.prototype.get = function (model) {
  if (model.noStore) { return; }
  var key = this.getKeyForModel(model);
  return Base.prototype.get.call(this, key);
};

ModelStore.prototype.remove = function (model) {
  if (model.noStore) { return; }

  var key = this.getKeyForModel(model);
  return Base.prototype.remove.call(this, key);
};

ModelStore.prototype.check = function (model, reset) {
  if (model.noStore || !exists(model.id())) {
    return model;
  }
  var modelInCache = this.get(model);
  if (modelInCache) {
    if (reset) {
      modelInCache.reset(model);
    }
    else {
      modelInCache.extend(model);
    }
    return modelInCache;
  }
  else {
    this.add(model);
    return model;
  }
};

ModelStore.prototype.checkNewModel = function (Model, attrs, opts) {
  var newModel, id;
  var reset = opts.reset;
  if (isString(attrs)) {
    id = attrs;
    newModel = new Model(id, opts); // setting id alone is not expensive (vs perf hack below)
  }
  else {
    // attrs is an object
    // We need to create a model to check if its cached
    // Initialize model as empty (see next comment)
    newModel = new Model({}, opts);
    // Set the attrs directly for now, avoid .reset/.parse call which can be expensive
    newModel.attrs = attrs;
    reset = exists(opts.reset) ? reset : true;
  }
  // Check if the model is already cached by the model-store
  var model = this.check(newModel, false);
  var modelNotCached = newModel === model;
  // If modelNotCached, the newModel was initialized by appending attrs directly
  // then set reset so that parse is called correctly.
  reset = reset || modelNotCached;
  if (reset) {
    // Else if reset is true, we need to reset the model bc we have new data
    if (modelNotCached) {
      // Undo directly setting the attrs, so that .parse
      // works as if it is being run the first time.
      newModel.attrs = {};
    }
    model.reset(attrs);
  }
  // Check if developer forgot to put a user id and warn them if they did
  opts.warn = exists(opts.warn) ? opts.warn : true;
  if (!model.id() && opts.warn) {
    consoleWarn(
      'possible duplicate model created.',
      'model created without an id.',
      'model store cannot dedupe this model:',
      Model.name, JSON.stringify(attrs), opts.warn
    );
  }
  return model;
};

ModelStore.prototype.off = function (event, handler) {
  if (arguments.length === 1) {
    this.removeAllListeners(event);
  }
  else {
    this.removeListener(event, handler);
  }
};

var isBrowser = typeof window !== 'undefined' || process.env.NODE_ENV === 'browser';
module.exports = new ModelStore({ enabled: isBrowser });

'use strict';

var util = require('util');
var jsonHash = require('json-hash');
var Base = require('./base');
var modelStore = require('./model-store');
var exists = require('101/exists');
var isEmpty = require('101/is-empty');
var isString = require('101/is-string');

function CollectionStore (opts) {
  return Base.call(this, opts);
}

util.inherits(CollectionStore, Base);

CollectionStore.prototype.getKeyForCollection = function (collection) {
  if (collection.noStore) { return; }
  var queryHash = jsonHash.digest(collection.query());
  var key = collection.path().toLowerCase() +'-'+ queryHash;
  return key;
};

CollectionStore.prototype.add = function (collection) {
  if (collection.noStore) { return; }
  var key = this.getKeyForCollection(collection);
  collection.models = collection.models.map(function (model) {
    return modelStore.check(model);
  });
  return Base.prototype.set.call(this, key, collection);
};

CollectionStore.prototype.remove = function (collection) {
  if (collection.noStore) { return; }
  var key = this.getKeyForCollection(collection);
  collection.models.forEach(function (model) {
    return modelStore.remove(model);
  });
  return Base.prototype.remove.call(this, key);
};

CollectionStore.prototype.get = function (collection) {
  if (collection.noStore) { return; }
  var key = this.getKeyForCollection(collection);
  return Base.prototype.get.call(this, key);
};

CollectionStore.prototype.check = function (collection, reset) {
  if (collection.noStore) {
    return collection;
  }
  var collectionInCache = this.get(collection);
  if (collectionInCache) {
    if (reset) {
      collectionInCache.reset(collection.models);
    }
    collection.dealloc();
    return collectionInCache;
  }
  else {
    this.add(collection);
    return collection;
  }
};

CollectionStore.prototype.isCached = function (collection) {
  if (collection.noStore) {
    return false;
  }
  return !!this.get(collection);
};

CollectionStore.prototype.checkNewCollection = function (Collection, models, opts) {
  // Initialize collection as empty initially to avoid unneccessary .reset calls.
  var newCollection = new Collection([], opts);
  var reset = exists(opts.reset) ?
    opts.reset :
    (isEmpty(models) || !isString(models[0])); // attrs not just ids (unpop subdocs)
  // Check if the collection was cached in the collection-store
  var collectionIsCached = this.isCached(newCollection);
  if (collectionIsCached) {
    newCollection = this.check(newCollection);
  } else {
    // Always reset new collections.
    reset = true;
    // We created a NEW collection. Store it so we don't have to create it again :)
    if (!newCollection.noStore) {
      this.add(newCollection);
    }
  }
  if (reset) {
    // If not found in cache, force reset, to initially set the new collection's models
    newCollection.reset(models);
  }
  return newCollection;
};

var isBrowser = typeof window !== 'undefined' || process.env.NODE_ENV === 'browser';
module.exports = new CollectionStore({ enabled: isBrowser });
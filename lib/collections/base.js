'use strict';
var util = require('util');
var EventEmitter = require('../event-emitter');
var isFunction = require('101/is-function');
var isString = require('101/is-string');
var hasKeypaths = require('101/has-keypaths');
var pathJoin = require('../url-join');
var modelStore = require('../stores/model-store');
var find = require('101/find');
var last = require('101/last');
var equals = require('101/equals');
var exists = require('101/exists');
var findIndex = require('101/find-index');
var clone = require('101/clone');
var keypather = require('keypather')();
var extend = require('extend');
var consoleWarn = require('../console-warn');
var isBrowser = require('../is-browser');
var bindAll = require('101/bind-all');

module.exports = Collection;

function Collection (models, opts) {
  this.models = [];
  this.modelsHash = {};
  this.opts = opts || {};
  if (this.opts.Model) {
    this.Model = this.opts.Model;
  }
  if (!this.opts.noStore) {
    if (!this.opts.client) {
      throw new TypeError('collection requires a client');
    }
    if (!this.Model) {
      throw new TypeError('collection requires a Model'); // optional urlPath
    }
    if (this.opts.urlPath) {
      this.urlPath = this.opts.urlPath;
    }
    else if (this.opts.parentPath) {
      if (!this.urlPath) {
        throw new TypeError('collection requires a urlPath'); // optional urlPath
      }
      this.urlPath = pathJoin(this.opts.parentPath, this.urlPath);
    }
    this.query(this.opts.qs);
  }
  if (this.opts.noStore) {
    this.noStore = this.opts.noStore;
  }
  this.client = this.opts.client;
  this.user = this.opts.user;
  bindAll(this, [
    'handleDestroy'
  ]);
  this.setMaxListeners(300);
  // below must be last
  this.add(models || []);
}

util.inherits(Collection, EventEmitter);

// inherit from array
['map', 'filter', 'reduce', 'reduceRight', 'indexOf', 'forEach'].forEach(function (method) {
  Collection.prototype[method] = function () {
    var models = this.models;
    return models[method].apply(models, arguments);
  };
});

Collection.prototype.query = function (qs) {
  if (arguments.length === 1){
    this.qs = qs || {};
  }
  return this.qs;
};

Collection.prototype.newModelOpts = function () {
  // Note: bc opts is circular omit fails to clone
  // omit was not working here; to remove
  // noStore from being inherited from child
  // models.
  var opts = clone(this.opts, false, 1);
  delete opts.noStore;
  return opts;
};

Collection.prototype.newModel = function (attrs, opts) {
  opts = extend(this.newModelOpts(), opts || {});
  opts.reset = !isString(attrs) && !this.opts.noStore;
  return modelStore.checkNewModel(this.Model, attrs, opts);
};

Collection.prototype.getModelIdFromData = function (attrs) {
  if (isString(attrs)) {
    return attrs; // attrs is id
  }
  var idAttribute = keypather.get(this, 'Model.prototype.idAttribute');
  return idAttribute ?
    attrs[idAttribute] :
    this.newModel(attrs).id();
};

Collection.prototype.instanceOfModel = function (model) {
  return model instanceof this.Model;
};

Collection.prototype.find = function (fn) {
  return find(this.models, fn);
};

Collection.prototype.findIndex = function (fn) {
  return findIndex(this.models, fn);
};

Collection.prototype.contains = function (data) {
  var dataIsModel = this.instanceOfModel(data);
  var modelId = dataIsModel ?
    data.id() :
    this.getModelIdFromData(data); // generated for checking only
  if (!exists(modelId)) {
    if (!dataIsModel) {
      consoleWarn(
        'possible duplicate collection model detected.',
        'data ( model) without "idAttribute" found.',
        data
      );
      return false;
    }
    else {
      return this.models.some(equals(data));
    }
  }

  return !!this.getById(modelId);
};

Collection.prototype.reset = function (data) {
  var self = this;
  if (this.dataMatchesCurrentModels(data)) {
    // update model data only, since collection data could hold new model data
    data.forEach(function (attrs) {
      if (!attrs.toJSON) {
        // if the attrs is not a model,
        // else it would be trying to update itself..
        self.newModel(attrs);
      }
    });
    return; // block add, if data matches current state
  }
  this.models.forEach(this.remove.bind(this));
  this.models = [];
  this.modelsHash = {};
  this.add(data, { silent: true });
  return this;
};

Collection.prototype.dataMatchesCurrentModels = function (data) {
  return data.length === this.models.length &&
    data.every(this.contains.bind(this));
};

Collection.prototype.create = function (data, cb) {
  var self = this;
  data = data.json || data.body || data;
  var model = this.newModel(data, { warn: false });
  self.add(model);
  model.create(data, function (err, body, code) {
    if (err) {
      self.remove(model);
    }
    else {
      modelStore.check(model);
    }
    cb(err, body, code);
  });
  return model;
};

Collection.prototype.destroy = function (model, cb) {
  model.destroy(cb);
};

Collection.prototype.add = function (data, opts) {
  var self = this;
  data = data || [];
  data = Array.isArray(data) ? data : [data];

  data.forEach(function (model) {
    var isModel = self.instanceOfModel(model);
    if (!isModel) {
      model = self.newModel(model);
    }
    if (!(self.contains(model))) {
      self._addToHash(model);
      self.models.push(model);
      if (isBrowser) {
        // isBrowser check: these event handlers are only relevant for
        // long living collections in the browser
        model.once('destroy', self.handleDestroy);
      }
      if (!opts || !opts.silent) {
        self.emit('add', model);
      }
    }
  });

  return this;
};

Collection.prototype._addToHash = function (model) {
  var self = this;
  if (model.id()) {
    if (self.contains(model)) {
      self.removeDuplicates(model);
    }
    else {
      self.modelsHash[model.id()] = model;
    }
  }
  else if (isBrowser) {
    // isBrowser check: these event handlers are only relevant for
    // long living collections in the browser
    model.once('update', onUpdate);
    model.once('created:error', onCreatedError);
  }
  function onUpdate (model) {
    model.off('created:error', onCreatedError);
    self._addToHash(model);
  }
  function onCreatedError () {
    model.off('update', onUpdate);
  }
};

Collection.prototype.handleDestroy = function (model) {
  var self = this;
  this.remove(model);
  model.once('destroyed', onDestroySuccess);
  model.once('destroyed:error', onDestroyError);
  function onDestroySuccess (model) {
    model.off('destroyed:error', onDestroyError);
  }
  function onDestroyError (model) {
    model.off('destroyed', onDestroySuccess);
    self.add(model);
  }
};

Collection.prototype.remove = function (model) {
  var modelId = model.id();
  delete this.modelsHash[modelId];
  model.off('destroy', this.handleDestroy);
  var removeIndex;
  // remove model from collection models
  removeIndex = findIndex(this.models, hasKeypaths({ 'id()': model.id() }));
  if (~removeIndex) {
    this.models.splice(removeIndex, 1);
    this.emit('remove', model);
  }
};

Collection.prototype.removeDuplicates = function (model) {
  var firstDupe = true;
  var self = this;
  var models = this.models;
  this.models = models.reduce(function (filtered, compare) {
    if (compare.equals(model)) {
      if (firstDupe) {
        firstDupe = false;
        return keep(filtered, compare);
      }
      return filtered; // don't keep
    }
    return keep(filtered, compare);
  }, []);
  function keep (filtered, model) {
    var id = model.id();
    if (id) {
      model = modelStore.get(model);
      self.modelsHash[id] = model;
    }
    filtered.push(model);
    return filtered;
  }
};

Collection.prototype.getById = function (id) {
  return this.modelsHash[id];
};

Collection.prototype.path = function () {
  return this.urlPath || this.Model.prototype.urlPath;
};

Collection.prototype.fetch = function (opts, cb) {
  var self = this;
  var args = this.formatArgs(arguments);
  opts = args.opts;
  cb = args.cb;
  opts.statusCodes = opts.statusCodes || {
    200: true,
    400: false,
    401: false,
    404: false
  };
  this.query(opts.qs);
  return this.client.get(this.path(), opts, function (err, body, code, res) {
    if (err) {
      cb(err);
    }
    else if (!Array.isArray(body)) {
      err = new Error(self.constructor.name+' (collection) fetch received a non-array response');
      err.body = body;
      cb(err);
    }
    else {
      self.reset(body);
      cb(null, body, code, res);
    }
  });
};

Collection.prototype.toJSON = function () {
  return this.models.map(function (model) {
    return model.toJSON();
  });
};

Collection.prototype.formatArgs = function (args) {
  var opts = args[0];
  var cb = args[1];
  if (isFunction(opts)) {
    cb = opts;
    opts = null;
  }
  opts = this.formatOpts(opts);
  this.query(opts.qs); // sets the query
  return {
    opts: opts,
    cb: cb
  };
};

Collection.prototype.formatOpts = function (opts) {
  opts = opts || { qs: this.query() || {} };
  opts = opts.qs || opts.headers ?
    opts : { qs: opts }; // assume opts are qs if no qs key
  return opts;
};

Collection.prototype.last = function () {
  return last(this.models);
};

Collection.prototype.pop = function () {
  return this.models.pop();
};

Collection.prototype.dealloc = function () {
  return;
};

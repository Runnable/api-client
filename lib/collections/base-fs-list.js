'use strict';

var Base = require('./base');
var util = require('util');
var collectionStore = require('../stores/collection-store');
var modelStore = require('../stores/model-store');
var bindAll = require('101/bind-all');
var isBrowser = require('../is-browser');

module.exports = BaseFsList;
function BaseFsList () {
  if (!this.DirModel) {
    throw new TypeError('collection requires DirModel');
  }
  if (!this.FileModel) {
    throw new TypeError('collection requires FileModel');
  }
  bindAll(this, [
    'handleMove'
  ]);
  Base.apply(this, arguments);
}
util.inherits(BaseFsList, Base);

BaseFsList.prototype.newModel = function (modelOrAttrs) {
  var opts = this.newModelOpts();
  modelOrAttrs = modelOrAttrs || {};
  var attrs = modelOrAttrs.toJSON ? modelOrAttrs.toJSON() : modelOrAttrs;
  var model = attrs.isDir ?
    new this.DirModel(attrs, opts) :
    new this.FileModel(attrs, opts);

  return modelStore.check(model);
};

BaseFsList.prototype.instanceOfModel = function (model) {
  return (model instanceof this.DirModel || model instanceof this.FileModel);
};

BaseFsList.prototype.Model = true; // prevent collection constructor from blowing up

// FIXME: this is better solved by replacing all newModel calls with getModel...
BaseFsList.prototype.create = function (opts, cb) {
  var self = this;
  opts = this.formatCreateOpts(opts);
  var model = this.newModel(opts.json);
  delete model.attrs.name;
  delete model.attrs.path;
  model.create(opts, function (err, body, code) {
    if (!err) {
      self.add(model);
    }
    cb(err, body, code);
  });
  return model;
};

BaseFsList.prototype.add = function(dataOrModel, opts) {
  var self = this;
  var data = dataOrModel.toJSON ? dataOrModel.toJSON() : dataOrModel;
  // slash is an invalid char
  if (data.name && data.name.indexOf('/') > -1) {
    throw new Error('Filename cannot contain /');
  }
  if (isBrowser) {
    // isBrowser check: these event handlers are only relevant for
    // long living collections in the browser
    this.on('add', handleAdd);
    Base.prototype.add.call(this, dataOrModel, opts);
    this.off('add', handleAdd);
  }
  else {
    Base.prototype.add.call(this, dataOrModel, opts);
  }
  function handleAdd (model) {
    model.fsList = self;
  }
};

BaseFsList.prototype.remove = function () {
  if (isBrowser) {
    // isBrowser check: these event handlers are only relevant for
    // long living collections in the browser
    this.on('remove', handleRemove);
    Base.prototype.remove.apply(this, arguments);
    this.off('remove', handleRemove);
  }
  else {
    Base.prototype.remove.apply(this, arguments);
  }
  function handleRemove (model) {
    delete model.fsList;
  }
};

BaseFsList.prototype.createDir = function (name, cb) {
  var opts = {
    name: name,
    isDir: true
  };
  return this.create(opts, cb);
};

BaseFsList.prototype.createFile = function (name, cb) {
  var opts = {
    name: name
  };
  return this.create(opts, cb);
};

BaseFsList.prototype.formatCreateOpts = function (data) {
  var opts;
  if (data.json) {
    opts = data;
  }
  else if (data.qs) {
    opts = data;
  }
  else if ((data.json || data.body) && !(data.name || data.path)) {
    opts = data;
  }
  else {
    opts = { json: data };
  }
  opts.json = opts.json || opts.body;
  delete opts.body;
  if (!opts.json) {
    throw new Error('create requires a body');
  }
  opts.json.path = this.query().path;
  return opts;
};

BaseFsList.prototype.setNewQuery = function (qs) {
  collectionStore.remove(this);
  this.query(qs);
  collectionStore.add(this);
  this.updateModelUrlPaths();
};

BaseFsList.prototype.updateModelUrlPaths = function () {
  var fsList = this;
  this.forEach(function (model) {
    model.setNewPath(fsList.query().path);
  });
};
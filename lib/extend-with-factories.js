'use strict';

var debug = require('debug')('runnable-api-client');
var fs = require('fs');
var path = require('path');
var fsUtils = require('./fs-utils');
var exists = require('101/exists');
var isFunction = require('101/is-function');
var isObject = require('101/is-object');
var modelStore = require('./stores/model-store');
var collectionStore = require('./stores/collection-store');
var fullPath = fsUtils.fullPath;
var isNotDotFile = fsUtils.isNotDotFile;
var isFile = fsUtils.isFile;
var isDir = fsUtils.isDir;
var isBrowser = require('./is-browser');

var browserFsCacheFile = 'browser-fs-cache.js';
var browserFsCache = require('./browser-fs-cache.js');

// FIXME: opts is circular!!!

module.exports = function (Class, location) {
  location = exists(location) ? location : Class.name.toLowerCase();
  var userResource = (Class.name.toLowerCase() === 'user' && location === 'user');
  var collectionsDir = path.resolve(__dirname, 'collections', location);
  debug('collectionsDir: ' + collectionsDir);
  var collections = dirFiles(collectionsDir);

  var modelsDir = path.resolve(__dirname, 'models', location);
  debug('modelsDir: ' + modelsDir);
  var models = dirFiles(modelsDir);
  // new[Collection]
  // fetch[Collection]
  collections.forEach(function (Collection) {
    var collectionName = Collection.name;
    if (collectionName.indexOf('Base') === 0) {
      return; // skip
    }
    Class.prototype['new'+collectionName] = function (models, opts) {
      // if (!this.id()) {
      //   throw new Error('Factory methods cannot be used on model without id');
      // }
      if (!opts.qs && !opts.noStore) {
        throw new Error('QueryString (qs) or noStore is required for new Collections');
      }
      if (!this.opts.client) {
        console.log(Collection.name, opts, userResource, this.opts, this.constructor.name, this.uid, !!this.opts.client);
      }
      return collectionStore.checkNewCollection(Collection, models, defaultOpts(opts, this, userResource));
    };
    Class.prototype['fetch'+collectionName] = function (/* opts, cb */) {
      var qs = isObject(arguments[0]) ? arguments[0] : {};
      var collection = new Collection([], defaultOpts({ qs: qs }, this, userResource));
      var args = collection.formatArgs(arguments); // sets collection query too
      collection = collectionStore.check(collection);
      collection.fetch.call(collection, args.opts, args.cb);
      return collection;
    };
  });

  // new[Model(opts, cb)
  // create[Model](opts, cb)
  // fetch[Model](id, opts, cb)
  // update[Model](id, opts, cb)
  // destroy[Model](id, opts, cb)
  models.forEach(function (Model) {
    var modelName = Model.name;
    if (modelName.indexOf('Base') === 0) {
      return; // skip
    }
    Class.prototype['new'+modelName] = function (attrs, opts) {
      attrs = attrs || {};
      opts = opts || {};
      return modelStore.checkNewModel(Model, attrs, defaultOpts(opts, this, userResource));
    };
    Class.prototype['create'+modelName] = function (opts, cb) {
      // if (!this.id()) {
      //   throw new Error('Factory methods cannot be used on model without id');
      // }
      var model = new Model({}, defaultOpts({}, this, userResource));
      model.create(opts, cb);
      return model;
    };
    var actions = ['fetch', 'update', 'destroy'];
    actions.forEach(function (action) {
      Class.prototype[action+modelName] = function (/* [id,][ opts,] cb */) {
        // if (!this.id()) {
        //   throw new Error('Factory methods cannot be used on model without id');
        // }
        var attrs = modelName === 'User' ? this.host : {};
        var model = new Model(attrs, defaultOpts({}, this, userResource));
        var args = model.formatArgs(arguments); // sets the id
        if (!args.id) {
          var err = new TypeError('id is required');
          if (args.cb) {
            args.cb(err);
          }
          else {
            throw err;
          }
        }
        model = modelStore.check(model);
        model[action](args.opts, args.cb);
        return model;
      };
    });
    Object.keys(Model.prototype).forEach(function (method) {
      if (isFunction(Model.prototype[method]) && !isFactoryMethod(method)) {
        Class.prototype[method+modelName] = function (id, opts, cb) {
          // if (!this.id()) {
          //   throw new Error('Factory methods cannot be used on model without id');
          // }
          var model =  new Model(id, defaultOpts(opts, this, userResource));
          model = modelStore.check(model);
          model[method].call(model, opts, cb);
          return model;
        };
      }
    });
  });
};

function isFactoryMethod (name) {
  var actions = ['create', 'fetch', 'update', 'destroy'];
  return actions.some(startsButNotEqual(name));
}

function startsButNotEqual (str) {
  return function (start) {
    return str.indexOf(start) === 0 && start.length !== str.length;
  };
}

var buildCache = {};
function dirFiles (dirpath) {
  var models;
  if (isBrowser) {
    models = browserFsCache[path.relative(__dirname, dirpath)]();
  }
  else {
    var filepaths = !isDir(dirpath) ? [] :
      fs.readdirSync(dirpath)
        .filter(isNotDotFile)
        .map(fullPath(dirpath))
        .filter(isFile);
    buildCache[path.relative(__dirname, dirpath)] = filepaths.map(function (filepath) {
      return '.'+path.join('/', path.relative(__dirname, filepath));
    });
    models = filepaths.map(function (filepath) {
      return require(filepath);
    });

    createBrowserFsCache();
  }
  return models;
}

var buildPrintTimeout;
function createBrowserFsCache () {
  clearTimeout(buildPrintTimeout);
  buildPrintTimeout = setTimeout(function () {
    var browserFsCacheContent = 'module.exports = {\n';

    Object.keys(buildCache).forEach(function (parentModelPath) {
      var requirePaths = buildCache[parentModelPath];
      browserFsCacheContent += [
        '\t', JSON.stringify(parentModelPath),
        ': ',
        'function () {\n\t\treturn '+requirePaths.reduce(toRequireArrStr, '[]')+';\n\t}',
        ',\n'
      ].join('');
      function toRequireArrStr (requireArrStr, requirePath, i) {
        if (i === 0) {
          requireArrStr = '[\n';
        }
        requireArrStr += [
          '\t\t\t(function () {\n',
          '\t\t\t\tvar r = require(', JSON.stringify(requirePath), ');\n',
          '\t\t\t\tr.name = "'+require(requirePath).name+'";\n',
          '\t\t\t\treturn r;\n',
          '\t\t\t})()'
        ].join('');
        if (i < requirePaths.length-1) {
          requireArrStr += ',\n';
        }
        else {
          requireArrStr += '\n\t\t]';
        }
        return requireArrStr;
      }
    });
    browserFsCacheContent += '};';
    fs.writeFileSync(path.join(__dirname, browserFsCacheFile), browserFsCacheContent);
    if (process.env.NODE_ENV === 'build') {
      console.log(
        path.join(__dirname, browserFsCacheFile)+'\n',
        browserFsCacheContent);
    }
  }, 10);
}

function defaultOpts (opts, model, userResource) {
  opts = isObject(opts) ? opts : {};
  var classIsUser = /^users$/.test(model.urlPath);

  var omitKeys = ['parentPath', 'qs', 'noStore', 'warn', 'reset'];
  Object.keys(model.opts || {}).forEach(function (key) {
    if (!~omitKeys.indexOf(key)) {
      opts[key] = model.opts[key];
    }
  });
  if (classIsUser) {
    opts.parentPath = userResource ? 'users/me' : '';
    opts.user = model;
  }
  else {
    opts.parentPath = model.path();
  }
  return opts;
}

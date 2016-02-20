var http = require('http');
var util = require('util');
var extend = require('extend');
var expect = require('chai').expect;
var exists = require('101/exists');
var isObject = require('101/is-object');
var isString = require('101/is-string');
var User = require('../index');
var Model = require('../lib/models/base');
var BaseFs = require('../lib/models/base-fs');
var BaseFile = require('../lib/models/base-file');
var ApiClient = require('../lib/api-client');
var MockServer = require('./mocks/mock-server');

describe('etag support', function() {
  var etagOne = '"etag-1"';
  var etagTwo = '"etag-2"';

  describe('model', function() {
    var serverResponse = { id: 2, name: 'example' };
    var cachedResponse = { id: 2, name: 'different' };
    var invalidResponse = { id: 2, name: 'invalid' };
    var server;
    var model;
    var modelEtag;

    before(function(done) {
      server = new MockServer();
      server.app.disable('etag');

      Model.prototype.urlPath = '/resource';
      model = new Model({}, { client: server.getClient() });

      var ModelEtag = function() {
        Model.apply(this, arguments);
      };
      util.inherits(ModelEtag, Model);
      ModelEtag.prototype.useETags = true;
      ModelEtag.prototype.urlPath = '/resource';
      modelEtag = new ModelEtag({}, { client: server.getClient() });

      server.get('/resource/:id', function(req, res) {
        var etag = req.headers['if-none-match'];

        // For the "non etag" model
        if (req.params.id == '1') {
          if (exists(etag)) {
            return res.status(400).send('Invalid: If-None-Match header should not be present.');
          }
          return res.send(serverResponse);
        }

        // For the "etag enabled" model
        if (!exists(etag)) {
          res.set('ETag', etagOne).send(serverResponse);
        } else if (etag == etagOne) {
          res.set('ETag', etagTwo).send(cachedResponse);
        } else if (etag == etagTwo) {
          res.set('ETag', etagTwo).status(304).send(invalidResponse);
        } else {
          res.status(400).send('Invalid: If-None-Match header did not provide a valid etag.');
        }
      });

      server.listen(done);
    });

    after(function(done) {
      delete Model.prototype.urlPath;
      server.close();
      done();
    });

    it('should not use etags by default', function(done) {
      expect(model.useETags).to.equal(false);
      done();
    });

    it('should set the initial etag value to null', function(done) {
      expect(modelEtag.etag).to.be.null;
      done();
    });

    it('should not send etags if disabled', function(done) {
      model.fetch('1', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(200);
        expect(model.attrs.name).to.equal(serverResponse.name);
        done();
      });
    });

    it('should set given response etag without providing If-None-Match header', function(done) {
      modelEtag.fetch('2', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(200);
        expect(modelEtag.etag).to.equal(etagOne);
        expect(modelEtag.attrs.name).to.equal(serverResponse.name);
        done();
      })
    })

    it('should set response etag appropriately when providing If-None-Match header', function(done) {
      modelEtag.fetch('2', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(200);
        expect(modelEtag.etag).to.equal(etagTwo);
        expect(modelEtag.attrs.name).to.equal(cachedResponse.name);
        done();
      });
    });

    it('should not set body data when using a cached etag', function(done) {
      modelEtag.fetch('2', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(304);
        expect(modelEtag.etag).to.equal(etagTwo);
        expect(modelEtag.attrs.name).to.equal(cachedResponse.name);
        done();
      });
    });
  });

  describe('file', function() {
    var server, file;
    var fileResponse = { name: 'example', body: 'file-response', path: '/' };
    var cachedFileResponse = { name: 'cached', body: 'file-cached', path: '/' };
    var invalidFileResponse = { name: 'cached', body: 'file-invalid', path: '/' };

    before(function(done) {
      BaseFile.prototype.urlPath = '/file';
      server = new MockServer();
      file = new BaseFile({ _id: '1' }, { client: server.getClient() });
      server.get('/file/:id', function(req, res) {
        var etag = req.headers['if-none-match'];
        if (!exists(etag)) {
          res.set('ETag', etagOne).send(fileResponse);
        } else if (etag == etagOne) {
          res.set('ETag', etagTwo).send(cachedFileResponse);
        } else if (etag == etagTwo) {
          res.set('ETag', etagTwo).status(304).send(invalidFileResponse);
        } else {
          res.status(400).send('Invalid: If-None-Match header did not provide a valid file etag.');
        }
      });
      server.listen(done);
    });

    after(function(done) {
      BaseFile.prototype.urlPath = BaseFs.prototype.urlPath;
      server.close();
      done();
    });

    it('should use etags by default', function(done) {
      expect(file.useETags).to.equal(true);
      done();
    });

    it('should set etags upon initial fetch', function(done) {
      file.fetch('1', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(200);
        expect(file.etag).to.equal(etagOne);
        expect(file.attrs.body).to.equal(fileResponse.body);
        done();
      });
    });

    it('should set the appropriate etag when fetching an updated version', function(done) {
      file.fetch('1', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(200);
        expect(file.etag).to.equal(etagTwo);
        expect(file.attrs.body).to.equal(cachedFileResponse.body);
        done();
      });
    });

    it('should appropriately handle cached content', function(done) {
      file.fetch('1', function(err, body, code, res) {
        if (err) { return done(err); }
        expect(code).to.equal(304);
        expect(file.etag).to.equal(etagTwo);
        expect(file.attrs.body).to.equal(cachedFileResponse.body);
        done();
      });
    });
  });
});

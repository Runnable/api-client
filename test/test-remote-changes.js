var expect = require('chai').expect;
var exists = require('101/exists');
var Model = require('../lib/models/base');
var MockServer = require('./mocks/mock-server');


describe('model has remote changes', function() {
  var server, model, modelModified, modelNotFetched;
  var now = 'Wed Mar 11 2015 13:58:11 GMT-0700 (PDT)',
      later = 'Wed Mar 15 2015 13:58:11 GMT-0700 (PDT)';

  before(function(done) {
    var path = Model.prototype.urlPath = '/resource';
    var attrs = { a: 20, b: 30 };
    server = new MockServer();
    var opts = { client: server.getClient() }

    model = new Model({ _id: '1'}, opts);
    modelModified = new Model({ _id: '2' }, opts);
    modelNotFetched = new Model({ _id: '3'}, opts)

    server.head(path + '/:id', function(req, res) {
      res.set('Last-Modified', (req.params.id == '2') ? later : now);
      res.send();
    });

    server.get(path + '/:id', function(req, res) {
      res.set('Last-Modified', now);
      res.send(attrs);
    });

    server.listen(function(err) {
      if (err) { return done(err); }
      // Prefetch second model so we don't have to do it again in the unit
      modelModified.fetch('2', function(err) {
        if (err) { return done(err); }
        done();
      })
    });
  });

  after(function(done) {
    delete Model.prototype.urlPath;
    server.close();
    done();
  });

  it('should keep track of the Last-Modified header', function (done) {
    model.fetch('1', function(err) {
      if (err) { return done(err); }
      expect(model.lastModified).to.equal(now);
      done();
    });
  });

  it('should report that there are no changes if a resource has not been modified', function (done) {
    model.hasRemoteChanges('1', function(err, changes) {
      if (err) { return done(err); }
      expect(changes).to.be.false;
      done();
    });
  });

  it('should report changes if a resource has been modified', function (done) {
    modelModified.hasRemoteChanges('2', function(err, changes) {
      if (err) { return done(err); }
      expect(changes).to.be.true;
      done();
    });
  });

  it('should throw an error if the model has not been previously fetched', function (done) {
    expect(modelNotFetched.hasRemoteChanges).to.throw(Error);
    done();
  });
});

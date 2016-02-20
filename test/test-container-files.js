var User = require('../index');
var expect = require('chai').expect;
var last = require('101/last');
var noop = require('101/noop');

describe('nested fs instances', function() {
  describe('containers', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      ctx.container = user
        .newInstance('instanceId')
        .newContainer('containerId');
      done();
    });
    afterEach(function (done) {
      ctx = {};
      done();
    });
    it('should have nested file models and collections', function(done) {
      expect(ctx.container).to.have.a.property('rootDir');
      expect(ctx.container.rootDir).to.have.a.property('path');
      expect(ctx.container.rootDir.path())
        .to.equal('instances/instanceId/containers/containerId/files/');
      expect(ctx.container.rootDir).to.have.a.property('contents');
      ctx.container.rootDir.contents.add({
        name: 'file.txt',
        path: '/',
        Key: '/instanceId/source/file.txt'
      });
      var file = ctx.container.rootDir.contents.models[0];
      expect(file.id())
        .to.equal('/file.txt');
      expect(file.path())
        .to.equal('instances/instanceId/containers/containerId/files/file.txt');
      ctx.container.rootDir.contents.add({
        name: 'dir',
        path: '/',
        Key: '/instanceId/source/dir',
        isDir: true
      });
      var dir = ctx.container.rootDir.contents.models[1];
      expect(dir.path())
        .to.equal('instances/instanceId/containers/containerId/files/dir/');
      expect(dir.contents.query())
        .to.eql({ path: '/dir/' });
      dir.contents.add({
        name: 'file.txt',
        path: '/dir',
        Key: '/instanceId/source/dir/file.txt'
      });
      expect(dir.contents.models[0].path())
        .to.equal('instances/instanceId/containers/containerId/files/dir/file.txt');
      done();
    });
    describe('move and rename', function() {
      it('should update file\'s url when a file is moved', function (done) {
        var rootDir = ctx.container.rootDir;
        rootDir.contents.add({
          name: 'file.txt',
          path: '/',
          Key: '/instanceId/source/file.txt'
        });
        var file = last(rootDir.contents.models);
        rootDir.contents.add({
          name: 'dir',
          path: '/',
          Key: '/instanceId/source/dir',
          isDir: true
        });
        var dir = last(rootDir.contents.models);
        file.client.patch = noop;
        file.moveToDir(dir);
        expect(file.path())
          .to.equal('instances/instanceId/containers/containerId/files/dir/file.txt');
        expect(rootDir.contents.models.length)
          .to.equal(1);
        done();
      });
      it('should update dir and it\'s contents urls when the dir is moved', function (done) {
        var rootDir = ctx.container.rootDir;
        // add dir1 and dir2 to root
        rootDir.contents.add({
          name: 'dir1',
          path: '/',
          Key: '/instanceId/source/dir1/',
          isDir: true
        });
        var dir1 = last(rootDir.contents.models);
        rootDir.contents.add({
          name: 'dir2',
          path: '/',
          Key: '/instanceId/source/dir2/',
          isDir: true
        });
        var dir2 = last(rootDir.contents.models);
        // add file1 and dir3 to dir2
        dir2.contents.add({
          name: 'file1',
          path: '/dir2',
          Key: '/instanceId/source/dir2/file1'
        });
        var file1 = last(dir2.contents.models);
        dir2.contents.add({
          name: 'dir3',
          path: '/dir2',
          Key: '/instanceId/source/dir2/dir3/',
          isDir: true
        });
        var dir3 = last(dir2.contents.models);
        // add file2 to dir3
        dir3.contents.add({
          name: 'file2',
          path: '/dir2',
          Key: '/instanceId/source/dir2/file2'
        });
        var file2 = last(dir3.contents.models);
        // move dir2 into dir1
        dir2.client.patch = noop;
        dir2.moveToDir(dir1);
        expect(dir2.path())
          .to.equal('instances/instanceId/containers/containerId/files/dir1/dir2/');
        expect(file1.path())
          .to.equal('instances/instanceId/containers/containerId/files/dir1/dir2/file1');
        expect(dir3.path())
          .to.equal('instances/instanceId/containers/containerId/files/dir1/dir2/dir3/');
        expect(file2.path())
          .to.equal('instances/instanceId/containers/containerId/files/dir1/dir2/dir3/file2');
        expect(rootDir.contents.models.length)
          .to.equal(1);
        done();
      });
      it('should throw an error if the filename contains /', function () {
        function givesErr() {
          ctx.container.rootDir.contents.add({
            name: 'fil/e.txt',
            path: '/',
            Key: '/instanceId/source/file.txt'
          });
        }

        expect(givesErr).to.throw('Filename cannot contain /');
      });
    });
  });
});
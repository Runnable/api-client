var User = require('../index');
var expect = require('chai').expect;
var keypather = require('keypather')();

describe('github commits (on branches)', function() {
  afterEach(function (done) {
    ctx = {};
    done();
  });
  describe('org branches', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      ctx.repo = user
        .newGithubOrg('orgname')
        .newRepo({
          name: 'reponame',
          owner: {
            login: 'orgname'
          }
        });
      done();
    });
    it('should have the right url', function(done) {
      expect(ctx.repo.newCommit('fffff').path())
        .to.equal('github/repos/orgname/reponame/commits/fffff');
      done();
    });
    it('should have correct url for collection', function (done) {
      expect(ctx.repo.newCommits([], {
        qs: {}
      }).path())
        .to.equal('github/repos/orgname/reponame/commits');
      done();
    });
    it('should have the right url and query for branch commits', function(done) {
      expect(ctx.repo.newBranch('branch').commits.path())
        .to.equal('github/repos/orgname/reponame/commits');
      expect(ctx.repo.newBranch('branch').commits.query())
        .to.eql({
          sha: 'branch',
          per_page: 100
        });
      done();
    });
  });
  describe('user branches', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      keypather.set(user,
        'attrs.accounts.github.username',
        'username');
      ctx.repo = user.newGithubRepo({
        name: 'reponame',
        owner: {
          login: 'username'
        }
      });
      done();
    });
    it('should have the right url', function(done) {
      expect(ctx.repo.newCommit('fffff').path())
        .to.equal('github/repos/username/reponame/commits/fffff');
      done();
    });
    it('should have correct url for collection', function (done) {
      expect(ctx.repo.newCommits([], {
        qs: {}
      }).path())
        .to.equal('github/repos/username/reponame/commits');
      done();
    });
    it('should have the right url and query for branch commits', function(done) {
      expect(ctx.repo.newBranch('branch').commits.path())
        .to.equal('github/repos/username/reponame/commits');
      expect(ctx.repo.newBranch('branch').commits.query())
        .to.eql({
          sha: 'branch',
          per_page: 100
        });
      done();
    });
  });
});

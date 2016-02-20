var User = require('../index');
var expect = require('chai').expect;
var keypather = require('keypather')();

describe('github repos', function() {
  afterEach(function (done) {
    ctx = {};
    done();
  });
  describe('orgs', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      keypather.set(user,
        'attrs.accounts.github.username',
        'username');
      ctx.githubOrg = user
        .newGithubOrg('orgname');
      done();
    });
    it('should have the right url for collection', function(done) {
      expect(ctx.githubOrg.newRepos([], {qs:{}}).path())
        .to.equal('github/orgs/orgname/repos');
      done();
    });
    it('should have the right url for model', function(done) {
      expect(ctx.githubOrg.newRepo('reponame').path())
        .to.equal('github/repos/orgname/reponame');
      done();
    });
  });
  describe('user', function() {
    var ctx = {};
    beforeEach(function (done) {
      ctx.user = new User();
      keypather.set(ctx.user,
        'attrs.accounts.github.username',
        'username');
      done();
    });
    it('should have the right url for collection', function(done) {
      expect(ctx.user.newGithubRepos([],{qs:{}}).path())
        .to.equal('github/user/repos');
      done();
    });
    it('should have the right url for model', function(done) {
      expect(ctx.user.newGithubRepo({
        name: 'reponame',
        owner: {
          login: 'ownername'
        }
      }).path())
        .to.equal('github/repos/ownername/reponame');
      done();
    });

    it('should have the right url when fetching repos from different users', function (done) {
      var githubRepos = ctx.user.newGithubRepos([], {qs: {}});
      githubRepos.client.get = function (url, opts, cb) {
        cb(null, [{
          owner: {
            login: 'cflynn07'
          },
          name: 'test1'
        }, {
          owner: {
            login: 'TJ'
          },
          name: 'test2'
        }]);
      };
      githubRepos.fetch(function () {
        expect(githubRepos.models[0].path())
          .to.equal('github/repos/cflynn07/test1');
        expect(githubRepos.models[1].path())
          .to.equal('github/repos/TJ/test2');
        done();
      });
    });

  });
});

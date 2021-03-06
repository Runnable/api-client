runnable-api-client
===================

[![Build Status](https://travis-ci.org/Runnable/api-client.svg?branch=master)](https://travis-ci.org/Runnable/api-client)

Runnable Api Client

# Usage

## Users

### Tokenless
```js
var user = new Runnable();
```

### Github Login
```js
var user = new Runnable();

user.githubLogin(function (err, body) {
  // ...
});
```

### Github Token Login
```js
var user = new Runnable();

user.githubLogin(token, function (err, body) {
  // ...
});
```

### Logout
```js
var user = new Runnable();

user.logout('user', 'pass', function (err, body) {
  // ...
});
```

## Resources

### First level resource (projects)
```js
var user = new Runnable();

user.login('user', 'pass', function (err, body) {
  // fetch a specific resource
  var project = user.fetchProject(projectId, function (err, body, code) {
    // project becomes a project model
  });
  // factory methods and parent actions
  project = user.newProject(attrs, opts);
  project = user.fetchProject(projectId, cb);
  project = user.createProject({ json: data }, cb);
  project = user.updateProject(projectId, { json: data }, cb);
  user.destroyProject(projectId, cb);
  // model methods
  project.fetch(cb); // fetch latest
  project.update({ json: attrs }, cb); // update the resource attrs
  project.destroy(cb); // delete the resource through the api
  project.toJSON(); // last clientside known state of the resource

  // fetch a collection of resources
  var projects = user.fetchProjects(projectId, function (err, body, code) {
    // project becomes a collection of projects
  });
  projects.models; // are all models of the resources fetched
});
```


# Development

## How to add a Model

Runnable api client's directory structure follows the api url
structure and the structure of our resources.

### Example - Adding a model for project environments:
Project environments are a nested resource - /projects/:id/environments/:id

#### Create a new file - lib/models/project/environment.js

Note: the singular form of each resource used for the folder and file names.

```js
'use strict';

var util = require('util');
var Base = require('../base');
var urlJoin = require('../../url-join');

module.exports = Environment;

function Environment (attr, opts) {
  opts = opts || {};
  opts.urlPath = urlJoin(opts.parentPath, 'environments');
  return Base.apply(this, arguments);
}

util.inherits(Environment, Base);
```

All (99%) of the new models will inherit from the Base Model class like the example above.
Nested Models use `urlJoin(opts.parentPath, <relativePath>)` create their urlPath using
opts.parentPath. `opts` are being passed to the constructor from `extend-with-factories`
which is explained below. First level resources like Projects (/projects), just need their
urlPath set directly `Projects.prototype.urlPath = 'projects'` or `opts.urlPath = 'projects'`.

#### Update the parent model Class - lib/models/project.js

The parent model in this example is Project. Here is the Project Class:

```js
var util = require('util');
var Base = require('./base');

module.exports = Project;

function Project () {
  return Base.apply(this, arguments);
}

util.inherits(Project, Base);

Project.prototype.urlPath = 'projects';
```

Add the following line to the parent model to automagically create submodel factory/action methods:
```js
require('../extend-with-factories')(Project);
```

#### Example usage of the newly created environment model

```js
var projectId = "real-project-id";
var user = new Runnable(), environment;

user.anonymous(function (err) {
  if (err) { throw err; }

  var project = user.fetchProject(projectId, function (err) {
    if (err) { throw err; }

    // automagical environment factory methods:
    environment = project.newEnvironment(attrs, opts);  // create a new environment instance
    environment = project.fetchEnvironment(projectId, cb); // fetches an environment instance from the api server
    environment = project.createEnvironment({ json: attrs }, cb); // makes a post request to create a new environment
    // automagical environment action methods:
    project.updateEnvironment(projectId, { json: attrs }, cb);
    project.destroyEnvironment(projectId, cb);

    // Action methods inherited by the Base Model
    environment.fetch(cb); // get latest data from server
    environment.update({ json: attrs }, cb);
    environment.destroy(cb);
  });
});

```

## How to add a Collection

Creating a collection is very similar to the model example. The only difference is that you
should inherit from the Base collection. Also, factory methods created use the plural form
of the resource name - Ex: `project.getEnvironments(cb)`. There are examples of all types of
models and collections (first level and nested), when in doubt look for an existing example
in the code base.

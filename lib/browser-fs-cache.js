module.exports = {
	"collections": function () {
		return [
			(function () {
				var r = require("./collections/auto-isolation-configs.js");
				r.name = "AutoIsolationConfigs";
				return r;
			})(),
			(function () {
				var r = require("./collections/base-fs-list.js");
				r.name = "BaseFsList";
				return r;
			})(),
			(function () {
				var r = require("./collections/base-github-branches.js");
				r.name = "BaseGithubBranches";
				return r;
			})(),
			(function () {
				var r = require("./collections/base-github-repos.js");
				r.name = "BaseGithubRepos";
				return r;
			})(),
			(function () {
				var r = require("./collections/base-github.js");
				r.name = "BaseGithub";
				return r;
			})(),
			(function () {
				var r = require("./collections/base.js");
				r.name = "Collection";
				return r;
			})(),
			(function () {
				var r = require("./collections/builds.js");
				r.name = "Builds";
				return r;
			})(),
			(function () {
				var r = require("./collections/contexts.js");
				r.name = "Contexts";
				return r;
			})(),
			(function () {
				var r = require("./collections/debug-containers.js");
				r.name = "DebugContainers";
				return r;
			})(),
			(function () {
				var r = require("./collections/github-orgs.js");
				r.name = "GithubOrgs";
				return r;
			})(),
			(function () {
				var r = require("./collections/github-repos.js");
				r.name = "GithubRepos";
				return r;
			})(),
			(function () {
				var r = require("./collections/groups.js");
				r.name = "Groups";
				return r;
			})(),
			(function () {
				var r = require("./collections/instances.js");
				r.name = "Instances";
				return r;
			})(),
			(function () {
				var r = require("./collections/isolations.js");
				r.name = "Isolations";
				return r;
			})(),
			(function () {
				var r = require("./collections/settings.js");
				r.name = "Settings";
				return r;
			})(),
			(function () {
				var r = require("./collections/teammate-invitation.js");
				r.name = "TeammateInvitations";
				return r;
			})(),
			(function () {
				var r = require("./collections/templates.js");
				r.name = "Templates";
				return r;
			})(),
			(function () {
				var r = require("./collections/user-whitelist.js");
				r.name = "UserWhitelists";
				return r;
			})(),
			(function () {
				var r = require("./collections/users.js");
				r.name = "Users";
				return r;
			})()
		];
	},
	"collections/autoisolationconfig": function () {
		return [];
	},
	"models/autoisolationconfig": function () {
		return [];
	},
	"collections/build": function () {
		return [];
	},
	"models/build": function () {
		return [];
	},
	"collections/context": function () {
		return [
			(function () {
				var r = require("./collections/context/versions.js");
				r.name = "Versions";
				return r;
			})()
		];
	},
	"collections/context/version": function () {
		return [
			(function () {
				var r = require("./collections/context/version/app-code-versions.js");
				r.name = "AppCodeVersions";
				return r;
			})(),
			(function () {
				var r = require("./collections/context/version/fs-list.js");
				r.name = "FsList";
				return r;
			})()
		];
	},
	"models/context/version": function () {
		return [
			(function () {
				var r = require("./models/context/version/app-code-version.js");
				r.name = "AppCodeVersion";
				return r;
			})(),
			(function () {
				var r = require("./models/context/version/dir.js");
				r.name = "Dir";
				return r;
			})(),
			(function () {
				var r = require("./models/context/version/file.js");
				r.name = "File";
				return r;
			})()
		];
	},
	"models/context": function () {
		return [
			(function () {
				var r = require("./models/context/version.js");
				r.name = "Version";
				return r;
			})()
		];
	},
	"collections/debug-container": function () {
		return [
			(function () {
				var r = require("./collections/debug-container/fs-list.js");
				r.name = "FsList";
				return r;
			})()
		];
	},
	"models/debug-container": function () {
		return [
			(function () {
				var r = require("./models/debug-container/dir.js");
				r.name = "Dir";
				return r;
			})(),
			(function () {
				var r = require("./models/debug-container/file.js");
				r.name = "File";
				return r;
			})()
		];
	},
	"collections/github-org": function () {
		return [
			(function () {
				var r = require("./collections/github-org/repos.js");
				r.name = "Repos";
				return r;
			})()
		];
	},
	"collections/base-github-repo": function () {
		return [
			(function () {
				var r = require("./collections/base-github-repo/branches.js");
				r.name = "Branches";
				return r;
			})(),
			(function () {
				var r = require("./collections/base-github-repo/commits.js");
				r.name = "Commits";
				return r;
			})()
		];
	},
	"models/base-github-repo": function () {
		return [
			(function () {
				var r = require("./models/base-github-repo/branch.js");
				r.name = "Branch";
				return r;
			})(),
			(function () {
				var r = require("./models/base-github-repo/commit.js");
				r.name = "Commit";
				return r;
			})()
		];
	},
	"models/github-org": function () {
		return [
			(function () {
				var r = require("./models/github-org/repo.js");
				r.name = "Repo";
				return r;
			})()
		];
	},
	"collections/group": function () {
		return [];
	},
	"models/group": function () {
		return [];
	},
	"collections/instance": function () {
		return [
			(function () {
				var r = require("./collections/instance/containers.js");
				r.name = "Containers";
				return r;
			})(),
			(function () {
				var r = require("./collections/instance/dependencies.js");
				r.name = "Dependencies";
				return r;
			})()
		];
	},
	"collections/instance/container": function () {
		return [
			(function () {
				var r = require("./collections/instance/container/fs-list.js");
				r.name = "FsList";
				return r;
			})()
		];
	},
	"models/instance/container": function () {
		return [
			(function () {
				var r = require("./models/instance/container/dir.js");
				r.name = "Dir";
				return r;
			})(),
			(function () {
				var r = require("./models/instance/container/file.js");
				r.name = "File";
				return r;
			})()
		];
	},
	"collections/instance/dependency": function () {
		return [];
	},
	"models/instance/dependency": function () {
		return [];
	},
	"models/instance": function () {
		return [
			(function () {
				var r = require("./models/instance/container.js");
				r.name = "Container";
				return r;
			})(),
			(function () {
				var r = require("./models/instance/dependency.js");
				r.name = "Dependency";
				return r;
			})()
		];
	},
	"collections/isolation": function () {
		return [];
	},
	"models/isolation": function () {
		return [];
	},
	"collections/setting": function () {
		return [];
	},
	"models/setting": function () {
		return [];
	},
	"collections/teammateinvitation": function () {
		return [];
	},
	"models/teammateinvitation": function () {
		return [];
	},
	"collections/template": function () {
		return [];
	},
	"models/template": function () {
		return [];
	},
	"collections/userwhitelist": function () {
		return [];
	},
	"models/userwhitelist": function () {
		return [];
	},
	"models": function () {
		return [
			(function () {
				var r = require("./models/auto-isolation-config.js");
				r.name = "AutoIsolationConfig";
				return r;
			})(),
			(function () {
				var r = require("./models/base-dir.js");
				r.name = "BaseDir";
				return r;
			})(),
			(function () {
				var r = require("./models/base-file.js");
				r.name = "BaseFile";
				return r;
			})(),
			(function () {
				var r = require("./models/base-fs.js");
				r.name = "BaseFs";
				return r;
			})(),
			(function () {
				var r = require("./models/base-github-repo.js");
				r.name = "BaseGithubRepo";
				return r;
			})(),
			(function () {
				var r = require("./models/base.js");
				r.name = "Model";
				return r;
			})(),
			(function () {
				var r = require("./models/build.js");
				r.name = "Build";
				return r;
			})(),
			(function () {
				var r = require("./models/context.js");
				r.name = "Context";
				return r;
			})(),
			(function () {
				var r = require("./models/debug-container.js");
				r.name = "DebugContainer";
				return r;
			})(),
			(function () {
				var r = require("./models/github-org.js");
				r.name = "GithubOrg";
				return r;
			})(),
			(function () {
				var r = require("./models/github-repo.js");
				r.name = "GithubRepo";
				return r;
			})(),
			(function () {
				var r = require("./models/group.js");
				r.name = "Group";
				return r;
			})(),
			(function () {
				var r = require("./models/instance.js");
				r.name = "Instance";
				return r;
			})(),
			(function () {
				var r = require("./models/isolation.js");
				r.name = "Isolation";
				return r;
			})(),
			(function () {
				var r = require("./models/setting.js");
				r.name = "Setting";
				return r;
			})(),
			(function () {
				var r = require("./models/teammate-invitation.js");
				r.name = "TeammateInvitation";
				return r;
			})(),
			(function () {
				var r = require("./models/template.js");
				r.name = "Template";
				return r;
			})(),
			(function () {
				var r = require("./models/user-whitelist.js");
				r.name = "UserWhitelist";
				return r;
			})(),
			(function () {
				var r = require("./models/user.js");
				r.name = "User";
				return r;
			})()
		];
	},
	"collections/user": function () {
		return [
			(function () {
				var r = require("./collections/user/routes.js");
				r.name = "Routes";
				return r;
			})()
		];
	},
	"models/user": function () {
		return [
			(function () {
				var r = require("./models/user/route.js");
				r.name = "Route";
				return r;
			})()
		];
	},
};
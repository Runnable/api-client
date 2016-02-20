module.exports = function (grunt) {
  var watchConfig = {
    tests: {
      files: './**/*.js',
      tasks: 'bgShell:mocha'
    }
  };

  var bgShellConfig = {
    mocha: {
      cmd: 'mocha'
    }
  };

  grunt.initConfig({
    watch: watchConfig,
    bgShell: bgShellConfig
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-bg-shell');

  grunt.registerTask('test-watch', ['watch:tests']);
};

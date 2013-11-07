// Karma configuration
// Generated on Sun Nov 03 2013 00:11:32 GMT-0700 (Pacific Daylight Time)

module.exports = function(config) {
  config.set({

    // base path, that will be used to resolve files and exclude
    basePath: '',


    // frameworks to use
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'app/components/angular/angular.js',
      'app/components/angular-mocks/angular-mocks.js',
      'app/components/rxjs/rx.js',
      'app/components/rxjs/rx.aggregates.js',
      'app/components/rxjs/rx.binding.js',
      'app/components/rxjs/rx.coincidence.js',
      'app/components/rxjs/rx.experimental.js',
      'app/components/rxjs/rx.joinpatterns.js',
      'app/components/rxjs/rx.time.js',
      'app/components/rxjs/rx.virtualtime.js',
      'app/components/rx-dom/rx.dom.js',

      'app/components/underscore/underscore.js',
      'app/components/underscore-contrib/underscore-contrib.js',
      'app/scripts/*.js',
      'app/scripts/**/*.js',
      "test/spec/utils.js",
      "scripts/**/*.js",
      "test/**/*_spec.js"
    ],


    // list of files to exclude
    exclude: [
      
    ],


    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['ChromeCanary'],


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false
  });
};

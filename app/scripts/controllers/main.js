'use strict';

angular.module('idbApp')
  .controller('MainCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];

        idb_proxy.create("test-" + new Date().getTime())
            .subscribe(function(v) {
                console.log(JSON.stringify(v));
            })
  });

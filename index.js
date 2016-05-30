(function (window, angular, undefined) {
  'use strict';

  angular
    .module('qleek', [])
    .service('qleekApi', function($q, $http) {

    var self = this;

    // TODO make this configurable
    var API_BASE_URL = "http://localhost:5001/api/v1/";

    self.sessionToken = null;

    self.isLoggedIn = function() { return self.sessionToken != null; };

    var api = function(method, endpoint, data, options) {
      var deferred = $q.defer();

      if (!options) { options = {}; }

      var headers = options.headers || {};
      if (! options.noAuth) {
        // TODO check that we have a sessionToken
        headers.Authorization = self.sessionToken;
      }

      console.log("headers:", headers);

      $http({
        url: API_BASE_URL + endpoint,
        method: method,
        data: data,
        headers: headers
      })
      .then(
        function success(response) {
          deferred.resolve(response.data);
        },
        function failure(reason) {
          deferred.reject(reason);
        }
      );

      return deferred.promise;
    }

    var apiGet = function(endpoint, options) {
      return api('GET', endpoint, null, options);
    }

    var apiPost = function(endpoint, data, options) {
      return api('POST', endpoint, data, options);
    }

    self.login = function(email, password) {
      var deferred = $q.defer();

      apiPost("login", {email: email, password: password}, {noAuth: true})
      .then(
        function success(data) {
          self.sessionToken = data.token;
          console.log("login success, token:", self.sessionToken);
          deferred.resolve();
        },
        function failure(reason) {
          console.log("login failed");
          deferred.reject();
        }
      );

      return deferred.promise;
    };

    self.logout = function(email, password) {
      var deferred = $q.defer();

      apiPost("logout")
      .then(
        function success(data) {
          // TODO check if "success: true" ?
          self.sessionToken = null;
          deferred.resolve();
        },
        function failure(reason) {
          console.log("logout failed");
          // FIXME forget session token anyway, although it is still usable ?
          self.sessionToken = null;
          deferred.reject();
        }
      );

      return deferred.promise;
    };


    self.getUserInfo = function() {
      return apiGet("user/me");
    }
  });

} (window, angular));
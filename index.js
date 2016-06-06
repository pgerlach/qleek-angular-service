(function (window, angular, undefined) {
  'use strict';

  angular
    .module('qleek', [])
    .provider('qleekApi', function qleekApiProvider($q, $http) {

    var self = this;
    // TODO make this configurable

    var API_BASE_URL;

      self.$get = ['ApiUrl', function qleekApiFactory(ApiUrl){
    return {
      setURL: function (URL) {
        API_BASE_URL = URL;
      },
      $get: function () {
        return {
          apiEndpoint: API_BASE_URL
        }
      },


      isLoggedIn: function () {
        return self.getToken() != null;
      },

      api: function (method, endpoint, data, options) {
        var deferred = $q.defer();

        if (!options) {
          options = {};
        }

        var headers = options.headers || {};
        if (!options.noAuth) {
          // TODO check that we have a sessionToken
          headers.Authorization = self.getToken();
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
      },

      apiGet: function (endpoint, options) {
        return api('GET', endpoint, null, options);
      },

      apiPost: function (endpoint, data, options) {
        return api('POST', endpoint, data, options);
      },

      apiPut: function (endpoint, data, options) {
        return api('PUT', endpoint, data, options);
      },

      login: function (email, password) {
        var deferred = $q.defer();

        this.apiPost("login", {email: email, password: password}, {noAuth: true})
            .then(
                function success(data) {
                  self.setToken(data.token);
                  console.log("login success, token:", self.setToken(data.token));
                  deferred.resolve();
                },
                function failure(reason) {
                  console.log("login failed");
                  deferred.reject();
                }
            );

        return deferred.promise;
      },

      setToken: function (sessionToken) {
        localStorage.setItem("token", sessionToken);
      },

      getToken: function () {
        return localStorage.getItem("token");
      },

      removeToken: function () {
        localStorage.removeItem("token");
      },

      logout: function (email, password) {
        var deferred = $q.defer();

        this.apiPost("logout")
            .then(
                function success(data) {
                  // TODO check if "success: true" ?
                  self.removeToken();
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
      },


      getUserInfo: function () {
        return this.apiGet("user/me");
      },

      getUserLibrary: function () {
        return this.apiGet("user/me/library");
      },

      getQleek: function (qleekId) {
        // TODO add populate options as a parameter
        return this.apiGet("qleek/" + qleekId + "?__populate=content,cover.imgThumb");
      },

      updateContent: function (contentId, updateData) {
        return this.apiPut("content/" + contentId, updateData);
      }
    }
  }]
});
} (window, angular));
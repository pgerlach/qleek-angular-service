(function (window, angular, undefined) {
  'use strict';

  angular
    .module('qleek', [])
    .provider('qleekApi', function qleekApiProvider() {

    // base url, settable by calling setURL
    var API_BASE_URL = null; // "http://localhost:5001/api/v1/";

    this.setURL = function (url) {
      console.log("BASE URL SET TO", url);
      API_BASE_URL = url;
    };

    // actual provider interface
    this.$get = function qleekApiFactory($q, $http) {

      var self = this;

      // internal functions
      var api = function (method, endpoint, data, options) {
        var deferred = $q.defer();

        if (!options) {
          options = {};
        }

        var headers = options.headers || {};
        if (!options.noAuth) {
          // TODO check that we have a sessionToken
          headers.Authorization = getToken();
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
      };

      var apiGet = function (endpoint, options) {
        return api('GET', endpoint, null, options);
      };

      var apiPost = function (endpoint, data, options) {
        return api('POST', endpoint, data, options);
      };

      var apiPut = function (endpoint, data, options) {
        return api('PUT', endpoint, data, options);
      };

      var setToken = function (sessionToken) {
        localStorage.setItem("token", sessionToken);
      };

      var getToken = function () {
        return localStorage.getItem("token");
      };

      var removeToken = function () {
        localStorage.removeItem("token");
      };

      console.log("HERE");

      return {

        isLoggedIn: function () {
          console.log("isLoggedIn", getToken() != null);
          return getToken() != null;
        },

        setToken: setToken,
        getToken: getToken,
        removeToken: removeToken,

        login: function (email, password) {
          var deferred = $q.defer();

          apiPost("login", {email: email, password: password}, {noAuth: true})
            .then(
              function success(data) {
                setToken(data.token);
                console.log("login success, token:", setToken(data.token));
                deferred.resolve();
              },
              function failure(reason) {
                console.log("login failed");
                deferred.reject();
              }
            );
          return deferred.promise;
        },

        logout: function (email, password) {
          var deferred = $q.defer();

          console.log("logout");

          apiPost("logout")
          .then(
              function success(data) {
                console.log("logout yay");
                // TODO check if "success: true" ?
                removeToken();
                deferred.resolve();
              },
              function failure(reason) {
                console.log("logout failed");
                // FIXME forget session token anyway, although it is still usable ?
                deferred.reject();
              }
          );

          return deferred.promise;
        },

        getUserInfo: function () {
          return apiGet("user/me");
        },

        getUserLibrary: function () {
          return apiGet("user/me/library");
        },

        getQleek: function (qleekId) {
          // TODO add populate options as a parameter
          return apiGet("qleek/" + qleekId + "?__populate=content,cover.imgThumb");
        },

        updateContent: function (contentId, updateData) {
          return apiPut("content/" + contentId, updateData);
        }
      }
    }
  });
} (window, angular));
(function (window, angular, undefined) {
  'use strict';

  angular
    .module('qleek', [])
    .provider('qleekApi', function qleekApiProvider() {

    // base url, settable by calling setURL
    var API_BASE_URL = null; // "http://localhost:5001/api/v1/";

    this.setURL = function (url) {
      url = url + '/api/v1/';
      API_BASE_URL = url;
    };

    // actual provider interface
    this.$get = function qleekApiFactory($q, $http) {


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


      return {

        isLoggedIn: function () {
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
                deferred.resolve();
              },
              function failure(reason) {
                deferred.reject(reason.data.message);
              }
            );
          return deferred.promise;
        },

        logout: function (email, password) {
          var deferred = $q.defer();

          apiPost("logout")
          .then(
              function success(data) {
                removeToken();
                deferred.resolve();
              },
              function failure(reason) {
                // forget session token anyway, although it is still usable: the user asked to logout
                removeToken();
                deferred.reject(reason.data.message);
              }
          );

          return deferred.promise;
        },

        getUserInfo: function () {
          return apiGet("user/me");
        },

        getUserLibrary: function (limit, skip) {
          if(limit || skip ){
            return apiGet("user/me/library?__populate=content,cover.imgThumb&limit=" + limit + '&skip=' +skip);
          } else {
            return apiGet("user/me/library?__populate=content,cover.imgThumb");
          }
        },

        getQleek: function (qleekId) {
          // TODO add populate options as a parameter
          return apiGet("qleek/" + qleekId + "?__populate=content,cover.imgThumb");
        },

        updateContent: function (contentId, updateData) {
          return apiPut("content/" + contentId, updateData);
        },

        getContentFromUri: function(uri) {
          return apiGet("content/fromUri?uri=" + encodeURIComponent(uri));
        },

        getStreamableTracks: function (url) {
          var deferred = $q.defer()
          var counter = 0;
          var userid = null;
          var result = {message: null};
          $http({
            url: 'https://api.soundcloud.com/resolve?url=' + url + '&client_id=' + config.SOUNDCLOUD_CLIENT_ID,
            method: 'GET'
          }).then(function success (response) {
            if(response.data.id && response.data.kind === 'user') {
              userid = response.data.kind === 'user' ? response.data.id : response.data.user.id;
              $http({
                url: 'https://api.soundcloud.com/users/' + userid + '/tracks?client_id=' + config.SOUNDCLOUD_CLIENT_ID,
                method: 'GET'
              }).then(function success (response) {
                for(var i in response.data){
                  if(response.data[i].streamable){
                    counter++
                  }
                }
                if(counter < 10){
                  if(!counter){
                    result.message = 'This artist has no available tracks on qleek';
                    result.counter = counter;
                  } else {
                    result.message = 'This artist has only ' + counter + ' tracks available on Qleek';
                    result.counter = counter;
                  }
                  deferred.resolve(result);   
                }
              });
            } else if (response.data.kind == 'playlist') {
              for(var i in response.data.tracks){
                if(response.data.tracks[i].streamable){
                  counter++
                }
              }
              if(counter < 10){
                if(!counter){
                  result.message = 'This playlist has no available tracks on qleek';
                  result.counter = counter;
                } else {
                  result.message = 'This playlist has only ' + counter + ' tracks available on Qleek';
                  result.counter = counter;
                }
                deferred.resolve(result);
              }
              
            }
          });
          return deferred.promise;
        }
      }
    }
  });
} (window, angular));
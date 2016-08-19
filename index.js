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

    var options = {
      autoCreateTemporaryUser: true
    };

    this.setOption = function(key, value) {
      options[key] = value;
    }

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

      var getUserInfo = function () {
        var token = getToken();
        if (token) {
          return apiGet("user/me")
          .catch(function failure(reason) {
            removeToken();
            return getUserInfo();
          });
        } else {
          if (options.autoCreateTemporaryUser) {
            return getTemporarySession()
            .then(function success() {
              return getUserInfo();
            });
          } else {
            return $q.reject("not logged in");
          }
        }
      }

      var getTemporarySession = function() {
        return apiPost("session/temporarySession")
        .then(
          function success(response) {
            setToken(response.token);
            return response;
          },
          function failure(reason) {
            return reason;
          }
        );
      };

      return {

        login: function (email, password) {
          return apiPost("login", {email: email, password: password}, {noAuth: true})
            .then(
              function success(data) {
                setToken(data.token);
                return getUserInfo();
              },
              function failure(reason) {
                return $q.reject(reason.data.message);
              }
            );
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

        getUserInfo: getUserInfo,

        getUserLibrary: function (limit, skip) {
          return apiGet("user/me/library?__populate=content,cover.imgThumb&format=full" + (limit ? "&limit=" + limit : "") + (skip ? '&skip=' + skip : ""));
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

        getStreamableTracks: function (uri, kind) {
          var deferred = $q.defer()
          var counter = 0;
          var userid = null;
          var result = {};
          var type = null;
          $http({
            url: uri + '/tracks?client_id=' + config.SOUNDCLOUD_CLIENT_ID,
            method: 'GET'
          }).then(function success (response) {
            for(var i in response.data){
              if(response.data[i].streamable){
                counter++
              }
            }
            type = kind === 'playlist' ? 'playlist' : 'artist';
            if(counter < 10){
              if(!counter){
                result.message = 'This ' + type + ' has no available tracks on qleek';
                result.counter = counter;
              } else {
                result.message = 'This ' + type + ' has only ' + counter + ' tracks available on Qleek';
                result.counter = counter;
              }
              deferred.resolve(result);
            }
          });
          return deferred.promise;
        },

        getOrder: function () {
          // FIXME we should remember the cartId so as not to re-query it every time
          return this.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return apiGet('order/' + userCartId + '?__populate=qleeks.desc,qleeks.desc.cover.imgThumb,packs.pack');
          })
        },

        updateOrder: function (data) {
          // FIXME we should remember the cartId so as not to re-query it every time
          return this.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return apiPut('order/' + userCartId, data);
          });
        },

        postCheckout: function (data) {
          return this.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return apiPost('checkout', data)
            .then(function success (response) {
              return response;
            });
          });
        },

        getPacks: function (limit, skip) {
          return apiGet("pack?__populate=covers.imgThumb&format=full" + (limit ? "&limit=" + limit : "") + (skip ? '&skip=' + skip : ""));
        },

        getPack: function (packId) {
          return apiGet('pack/' + packId + '?__populate=covers.imgThumb');
        }

      }
    }
  });
} (window, angular));
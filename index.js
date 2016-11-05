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
        if (!options.noAuth && getToken()) {
          headers.Authorization = getToken();
        }

        if (options.params && options.params.__populate && Array.isArray(options.params.__populate)) {
          options.params.__populate = options.params.__populate.join(",");
        }

        $http({
          url: API_BASE_URL + endpoint,
          method: method,
          data: data,
          headers: headers,
          params: options.params
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

      var apiDelete = function (endpoint, options) {
        return api('DELETE', endpoint, null, options);
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

      var getUserInfo = function (userId) {
        if (userId === undefined) {
          userId = "me";
        }
        var token = getToken();
        if (token) {
          return apiGet("user/" + userId)
          .catch(function failure(reason) {
            removeToken();
            return getUserInfo();
          });
        } else {
          if (options.autoCreateTemporaryUser && userId === "me") {
            return getTemporarySession()
            .then(function success() {
              return getUserInfo();
            });
          } else {
            return $q.reject("not logged in");
          }
        }
      }

      var updateUserInfo = function(data) {
        var token = getToken();
        if (token) {
          return apiPut("user/me", data);
        } else {
          return $q.reject("no user to update");
        }
      }

      var getTemporarySession = function() {
        if(API_BASE_URL == 'undefined/api/v1/') {
          return $q.reject('config not loaded');
        }
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

      var addToHistory = function(res) {
        var historyEntry = {};

        if(typeof res == 'object'){
          historyEntry.date = Date.now();
          historyEntry.playUri = res.data.content.data.playbackURI || res.data.content.data.uri;
          historyEntry.name = res.data.name;
          historyEntry.coverUrl = res.data.cover.imgThumb.url;
        }

        var currentHistory = localStorage.getItem('history');

        if(currentHistory != undefined || currentHistory != null) {
          currentHistory = JSON.parse(currentHistory);
        }    

        if(typeof currentHistory == 'object') {
          if(currentHistory == null) {
            currentHistory = []
          }

          currentHistory.push(historyEntry);
          localStorage.setItem('history', JSON.stringify(currentHistory));
        } else {
          currentHistory = [];
          currentHistory.push(historyEntry);
          localStorage.setItem('history', JSON.stringify(currentHistory));
        }
      };

      return {

        apiGet: apiGet,
        apiPost: apiPost,
        apiPut: apiPut,
        apiDelete: apiDelete,

        login: function (email, password, mergeCarts) {
          var params = {email: email, password: password};
          if (mergeCarts) {
            params.mergeCarts = mergeCarts;
          }
          return apiPost("login", params)
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
        updateUserInfo: updateUserInfo,

        getUserLibrary: function (limit, skip, populateFields) {
          return apiGet("user/me/library", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
        },

        getUserDevices: function (limit, skip) {
          return apiGet("user/me/players", {params: {limit: limit, skip: skip, format: "full"}});
        },

        getDeviceAssociationToken: function () {
          return apiGet("user/me/getTokenToRegisterNewPlayer");
        },

        getQleek: function (qleekId, populateFields) {
          // TODO add populate options as a parameter
          return apiGet("qleek/" + qleekId, {params: { __populate: populateFields}});
        },

        updateQleek: function (qleekId, updateData) {
          return apiPut("qleek/" + qleekId, updateData);
        },

        updateContent: function (contentId, updateData) {
          return apiPut("content/" + contentId, updateData);
        },

        getContentFromUri: function(uri) {
          return apiGet("content/fromUri", {params: {uri: uri}});
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

        getOrder: function (populateFields) {
          // FIXME we should remember the cartId so as not to re-query it every time
          return this.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return apiGet('order/' + userCartId, {params: { __populate: populateFields}});
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
          });
        },

        getPacks: function (limit, skip, populateFields) {
          return apiGet("pack", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
        },

        getPack: function (packId, populateFields) {
          return apiGet('pack/' + packId, {params: { __populate: populateFields}});;
        },

        resolveContent: function (url) {

          var deferred = $q.defer()
          var backendRegExp = new RegExp('https?:\/\/qleek-backend.herokuapp.com')
          var soundcloudRegExp = new RegExp('https?:\/\/api.soundcloud.com\/');
          var spotifyRegExp = new RegExp('spotify*:[a-zA-Z]*:[0-9A-Za-z]*:?[0-9A-Za-z]*:?[0-9A-Za-z]*:?');
          if(backendRegExp.test(url)){
            $http({
              url: url,
              method: 'GET'
            }).then(
              function success (response) {
                if(soundcloudRegExp.test(response.data.content.data.playbackURI)){
                  $http({
                    url: response.data.content.data.playbackURI + '?client_id=10948b9a846970f4ed4d0dc6e42d6e77',
                    method: 'GET'
                  }).then(
                    function success (res) {
                      addToHistory(response);
                      deferred.resolve(res.data.permalink_url);
                    }
                  );
                } else if (spotifyRegExp.test(response.data.content.data.uri)) {
                  var spotifyUri = response.data.content.data.uri;
                  spotifyUri = spotifyUri.replace('spotify:', '');
                  spotifyUri = spotifyUri.replace(/:/g, '/');
                  addToHistory(response);
                  deferred.resolve('https://open.spotify.com/' + spotifyUri);
                } else {
                  deferred.resolve('invalid');
                }
              },
              function failure (response) {
                deferred.reject(response.data);
              }
            );
          } else {
            if(soundcloudRegExp.test(url)){
                  $http({
                    url: url + '?client_id=10948b9a846970f4ed4d0dc6e42d6e77',
                    method: 'GET'
                  }).then(
                    function success (response) {
                      deferred.resolve(response.data.permalink_url);
                    }
                  );
                } else if (spotifyRegExp.test(url)) {
                  var spotifyUri = url;
                  spotifyUri = spotifyUri.replace('spotify:', '');
                  spotifyUri = spotifyUri.replace(/:/g, '/');
                  deferred.resolve('https://open.spotify.com/' + spotifyUri);
                } else {
                  deferred.resolve('invalid');
                }
          }
          
          return deferred.promise;
          
        },

        registerUser: function (user) {

          return apiPost('user', user)
          .then(function success (response) {
            return response;
          }, function failure (response) {
            return response;
          }); 

        },

        getCovers: function (limit, skip, populateFields) {
          return apiGet("cover", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
        },

        getCover: function(coverId, populateFields) {
          return apiGet("cover/" + coverId, {params: {__populate: populateFields}});
        },
        
        ////// METHODS RESTRICTED TO ADMINS //////

        adminUpdateQleek(qleekId, updateData) {
          return apiPut("admin/qleek/" + qleekId, updateData);
        },

        postCover: function(cover) {
          return apiPost("cover", cover)
        }
      }
    }
  });
} (window, angular));

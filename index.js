(function (window, angular, undefined) {
  'use strict';

  angular
  .module('qleek', [])
  .provider('qleekApi', function qleekApiProvider() {

    var self = this;

    // base url, settable by calling setURL
    self.API_BASE_URL = null; // "http://localhost:5001/api/v1/";

    self.config = {
      autoCreateTemporaryUser: true
    };

    // keep the user in "cache" because we use getUserInfo very ofter
    self.cachedUser = null;

    self.setURL = function (url) {
      url = url + '/api/v1/';
      self.API_BASE_URL = url;
    };

    // legacy
    self.setOption = function(key, value) {
      return self.setConfigKey(key, value);
    };

    self.setConfigKey = function(key, value) {
      self.config[key] = value;
    };

    // actual provider interface
    self.$get = function qleekApiFactory($q, $http, $rootScope) {

      // internal functions
      self.api = function (method, endpoint, data, options) {
        if (!options) {
          options = {};
        }

        var headers = options.headers || {};
        if (!options.noAuth && self.getToken()) {
          headers.Authorization = self.getToken();
        }

        if (options.params && options.params.__populate && Array.isArray(options.params.__populate)) {
          options.params.__populate = options.params.__populate.join(",");
        }

        return $http({
          url: self.API_BASE_URL + endpoint,
          method: method,
          data: data,
          headers: headers,
          params: options.params
        })
        .then(function success(response) {
          return response.data;
        });
      };

      self.apiGet = function (endpoint, options) {
        return self.api('GET', endpoint, null, options);
      };

      self.apiDelete = function (endpoint, options) {
        return self.api('DELETE', endpoint, null, options);
      };

      self.apiPost = function (endpoint, data, options) {
        return self.api('POST', endpoint, data, options);
      };

      self.apiPut = function (endpoint, data, options) {
        return self.api('PUT', endpoint, data, options);
      };

      self.setToken = function (sessionToken) {
        localStorage.setItem("token", sessionToken);
        self.cachedUser = null;
      };

      self.getToken = function () {
        return localStorage.getItem("token");
      };

      self.removeToken = function () {
        localStorage.removeItem("token");
        self.cachedUser = null;
        $rootScope.$emit('qleekApi:loggedOut');
      };

      self.getUserInfo = function (userId) {
        if (userId === undefined) {
          userId = "me";
        }
        var token = self.getToken();
        if (token) {
          if (userId === "me" && self.cachedUser) {
            return $q.resolve(self.cachedUser);
          }
          return self.apiGet("user/" + userId)
          .then(function(user) {
            if (userId === "me") {
              self.cachedUser = user;
              $rootScope.$emit('qleekApi:loggedIn', user);
            }
            return $q.resolve(user);
          })
          .catch(function failure(reason) {
            // token was expired. Return a temporary one ?
            self.removeToken();
            return self.getUserInfo();
          });
        } else {
          if (self.config.autoCreateTemporaryUser && userId === "me") {
            return getTemporarySession()
            .then(function success() {
              return getUserInfo();
            });
          } else {
            return $q.reject("not logged in");
          }
        }
      };

      self.updateUserInfo = function(data) {
        var token = self.getToken();
        if (token) {
          return self.apiPut("user/me", data);
        } else {
          return $q.reject("no user to update");
        }
      };

      self.getTemporarySession = function() {
        if(self.API_BASE_URL == 'undefined/api/v1/') {
          return $q.reject('config not loaded');
        }
        return apiPost("session/temporarySession")
        .then(function success(response) {
          self.setToken(response.token);
          return response;
        });
      };

      self.login = function (email, password, mergeCarts) {
        var params = {email: email, password: password};
        if (mergeCarts) {
          params.mergeCarts = mergeCarts;
        }
        self.removeToken();
        return self.apiPost("login", params)
        .then(
          function success(data) {
            self.setToken(data.token);
            return self.getUserInfo();
          },
          function failure(reason) {
            self.removeToken();
            return $q.reject(reason.data.message);
          }
          );
      };

      self.logout = function () {
        return self.apiPost("logout")
        .then(function success(data) {
          return $q.resolve();
        })
        .catch(function(reason) {
            // token will be removed anyway, no need to tell the user
          })
        .finally(function() {
          self.removeToken();
        });
      };

      self.getUserLibrary = function (limit, skip, populateFields) {
        return self.apiGet("user/me/library", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
      };

      self.getUserDevices = function (limit, skip) {
        return self.apiGet("user/me/players", {params: {limit: limit, skip: skip, format: "full"}});
      };

      self.getDeviceAssociationToken = function () {
        return self.apiGet("user/me/getTokenToRegisterNewPlayer");
      };

      self.getQleek = function (qleekId, populateFields, assocToUserIfNew) {
        return self.apiGet("qleek/" + qleekId, {params: { __populate: populateFields, __assocToUserIfNew: assocToUserIfNew}});
      };

      self.updateQleek = function (qleek, updateData) {
        return self.apiPut("qleek/" + self.getObjectId(qleek), updateData);
      };

      self.updateContent = function (contentId, updateData) {
        return self.apiPut("content/" + contentId, updateData);
      };

      self.createContent = function (data) {
        return self.apiPost("content", data);
      };

      self.getContentFromUri = function(uri) {
        return self.apiGet("content/fromUri", {params: {uri: uri}});
      };

      self.countSoundcloudStreamableTracks = function (uri) {
        return $http({
          url: uri + '/tracks?client_id=' + self.config.SOUNDCLOUD_CLIENT_ID,
          method: 'GET'
        }).then(function success (response) {
          return _.reduce(response.data, function(memo, track) {return memo + !!(track.streamable)}, 0);
        });
      };

      self.getOrder = function (populateFields) {
          // FIXME we should remember the cartId so as not to re-query it every time
          return self.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return self.apiGet('order/' + userCartId, {params: { __populate: populateFields}});
          })
        };

        self.updateOrder = function (data) {
          // FIXME we should remember the cartId so as not to re-query it every time
          return self.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return self.apiPut('order/' + userCartId, data);
          });
        };

        self.postCheckout = function (data) {
          return self.getUserInfo()
          .then(function success (response) {
            var userCartId = response.cart;
            return self.apiPost('checkout', data)
          });
        };

        self.getPacks = function (limit, skip, populateFields) {
          return self.apiGet("pack", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
        };

        self.getPack = function (packId, populateFields) {
          return self.apiGet('pack/' + packId, {params: { __populate: populateFields}});;
        };

        // returns a URI we can use to play the content on a mobile device
        // ideally this will be done in the backend
        self.resolveMobilePlayUriFromContent = function(content) {
          if (content.data.mobilePlayUri) {
            return $q.resolve(content.data.mobilePlayUri)
          }
          var uri = content.data.uri || content.data.playbackURI;

          var soundcloudRegExp = /https?:\/\/api.soundcloud.com\//;
          var spotifyRegExp = /^spotify*:[a-zA-Z]*:[0-9A-Za-z]*:?[0-9A-Za-z]*:?[0-9A-Za-z]*:?/;

          if (soundcloudRegExp.test(uri)) {
            return $http.get(uri, {
              params: {
                client_id: self.config.SOUNDCLOUD_CLIENT_ID
              }
            })
            .then(function success (response) {
              return $q.resolve(response.data.permalink_url);
            });
          } else if (spotifyRegExp.test(uri)) {
            var spotifyUri = uri.replace(/^spotify:/, '').replace(/:/g, '/');
            return $q.resolve('https://open.spotify.com/' + spotifyUri);
          } else {
            return $q.reject("unknown content type");
          }
        };

        self.registerUser = function (user) {
          return apiPost('user', user)
          .then(function success (response) {
            return response;
          }, function failure (response) {
            return response;
          });
        };

        self.getCovers = function (limit, skip, populateFields) {
          return self.apiGet("cover", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full"}});
        };

        self.getCover = function(coverId, populateFields) {
          return self.apiGet("cover/" + coverId, {params: {__populate: populateFields}});
        };

        // width and height are optional, but must be specified together
        self.getImage = function(image, width, height) {
          var imageId = self.getObjectId(image);
          var opts = {};
          if (width !== undefined && height !== undefined) {
            opts.params = {
              width: width,
              height: height
            }
          }
          return self.apiGet("image/" + imageId, opts);
        };

        ////// METHODS RESTRICTED TO ADMINS //////

        self.adminUpdateQleek = function(qleekId, updateData) {
          return self.apiPut("admin/qleek/" + qleekId, updateData);
        };

        self.postCover = function(cover) {
          return self.apiPost("cover", cover)
        };

        self.adminGetOrders = function(limit, skip, populateFields, status) {
          return self.apiGet("admin/orders", {params: {limit: limit, skip: skip, __populate: populateFields, format: "full", status: (status || "paid")}});
        };

        self.adminGetOrder = function(orderId, populateFields) {
          return self.apiGet("admin/order/" + orderId, {params: {__populate: populateFields}});
        };

        self.adminUpdateOrder = function(orderId, data) {
          return self.apiPut("admin/order/" + orderId, data);
        };

        /////// METHODS WITH SOME LOGIC IN THEM ///////

        // updates a Qleek's content. It's more complicated that just updating
        // the content, because it depends if the content belongs to the user
        // or not.
        self.updateQleekContent = function(qleek, newContentData) {
          return self.getQleek(self.getObjectId(qleek), ["content"])
          .then(function(response) {
            qleek = response;
            return self.getUserInfo()
          })
          .then(function(user) {
            // update content. Two possibilities : content is ours, or not. If not : create a new one.
            if (self.documentsAreEqual(qleek.content.owner, user)) {
              return self.updateContent(qleek.content._id, newContentData);
            } else {
              return self.createContent(newContentData)
              .then(function success(content) {
                // now update the qleek w/ the new content
                return self.updateQleek(qleek._id, {content: content._id});
              });
            }
          })
          .catch(function(reason) {
            self.errorMessage = reason.data.message;
          });
        };
        /////// UTILITIES METHODS ////////

        self.hasAccountForService = function(serviceName) {
          return self.apiGet("user/me/setting/" + serviceName)
          .then(function(success) {
            return $q.resolve(true);
          })
          .catch(function(reason) {
            if (reason.statusCode === 404) {
              return $q.resolve(false);
            }
            return $q.reject(reason);
          });
        };

        /*
         * updates a cover object with a thumbnail of the correct size
         * If there is already a thumbnail, use it. Else, try to use a
         * resized version of the picture used to print the qleek. If not
         * available, use the first illustrating picture.
         */
         self.updateCoverThumbnail = function(cover, width, height) {
          // if there is a thumbnail already, use it
          if (cover.imgThumb && cover.imgThumb.url) {
            // nothing to do
            return ;
          } else if (cover.imgRes) {
            // else try to show a thumbnail of the actual cover
            return self.getImage(cover.imgRes, 88, 76)
            .then(function success(img) {
              cover.imgThumb = img;
            });
          } else if (cover.pictures && cover.pictures.length > 0) {
            // else try to resize one of the pictures
            return self.getImage(cover.pictures[0], 88, 76)
            .then(function success(img) {
              cover.imgThumb = img;
            });
          } else {
            // nothing we can do
          }
        };

        // is this a 'regular shared' cover or a custom one ?
        self.isCustomCover = function(cover) {
          return !cover.public;
        };

        // Returns the object id of an object. o can be either an object or directly an object id
        // There is no real check : this method should not be used for validation !
        self.getObjectId = function(o) {
          if (typeof o === "string") {
            return o;
          } else if (o.hasOwnProperty("_id") && (typeof o._id === "string")) {
            return o._id;
          }
          throw new Error("o is neither a document nor an ObjectId");
        };

        self.documentsAreEqual = function(a, b) {
          if (a && a.hasOwnProperty("_id")) {
            a = a._id;
          }
          if (b && b.hasOwnProperty("_id")) {
            b = b._id;
          }
          if (typeof a !== "string" || typeof b !== "string" || a.length !== 24 || b.length !== 24) {
            throw new Error("a and/or b is neither a document nor an ObjectId");
          }
          return (a === b);
        };

        self.isQleekNew = function(qleekId) {
          return self.apiGet("qleek/" + qleekId + "?__noAssoc=1")
          .then(function(qleek) {
            return self.isDummyDocument(qleek.owner);
          });
        };

        self.isDummyDocument = function(o) {
          return (self.getObjectId(o) === "000000000000000000000000");
        }

        return _.pick(self, [
          "apiGet", "apiPost", "apiPut", "apiDelete",
          "login", "logout",
          "getUserInfo", "updateUserInfo",
          "getUserLibrary", "getUserDevices",
          "getDeviceAssociationToken",
          "getQleek", "updateQleek",
          "updateContent", "createContent", "getContentFromUri",
          "countSoundcloudStreamableTracks",
          "getOrder", "updateOrder",
          "postCheckout",
          "getPacks", "getPack",
          "resolveMobilePlayUriFromContent",
          "registerUser",
          "getCovers", "getCover",
          "getImage",
            // admin
            "adminUpdateQleek", "postCover", "adminGetOrders", "adminGetOrder", "adminUpdateOrder",
            // methods with some logic in them
            "updateQleekContent",
            // utils
            "hasAccountForService", "updateCoverThumbnail", "isCustomCover", "getObjectId",
            "documentsAreEqual", "isQleekNew", "isDummyDocument"
            ]);

      }
    });
} (window, angular));

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
        if (!self.API_BASE_URL) {
          return $q.reject("setURL had not been called");
        }

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
        var wasLoggedIn = !!self.cachedUser;
        localStorage.removeItem("token");
        self.cachedUser = null;
        if (wasLoggedIn) {
          $rootScope.$emit('qleekApi:loggedOut');
        }
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
              if (user.role !== 'temporary') {
                $rootScope.$emit('qleekApi:loggedIn', user);
              }
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
            return self.getTemporarySession()
            .then(function success() {
              return self.getUserInfo();
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
        return self.apiPost("session/temporarySession")
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

      self.getOrder = function (populateFields) {
        return self.getUserInfo()
        .then(function success (response) {
          var userCartId = response.cart;
          return self.apiGet('order/' + userCartId, {params: { __populate: populateFields}});
        })
      };

      self.updateOrder = function (data) {
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

      self.registerUser = function (user) {
        return self.apiPost('user', user);
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
      // returns a Promise that resolves to the qleek with the content populated
      self.updateQleekContent = function(qleek, newContentData) {
        return self.getQleek(self.getObjectId(qleek), ["content"])
        .then(function(response) {
          qleek = response;

          // TODO : Find better fix / This is temporary to make it work with recent changes in owned/managed qleeks
          // if (!self.canEditQleekContent(qleek)) {
          //   return $q.reject("Can't modify this Qleek's content");
          // };

          // update content. Two possibilities : content is ours, or not. If not : create a new one.
          if (self.objectIsMine(qleek.content)) {
            return self.updateContent(qleek.content._id, newContentData)
            .then(function(content) {
              qleek.content = content;
              return $q.resolve(qleek);
            })
          } else {
            return self.createContent(newContentData)
            .then(function success(content) {
              // now update the qleek w/ the new content
              return self.updateQleek(qleek._id, {content: content._id})
              .then(function(qleek) {
                qleek.content = content;
                return $q.resolve(qleek);
              })
            });
          }
        })
        .catch(function(reason) {
          return $q.reject(reason);
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
        if (a && a.hasOwnProperty("_id")) { a = a._id; }
        if (b && b.hasOwnProperty("_id")) { b = b._id; }
        if (!a) { a = "null                    "; }
        if (!b) { b = "null                    "; }
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
      };

      // returns true if a 'real' user is logged in (not a temporary one)
      self.isLoggedIn = function() {
        return (!!self.cachedUser && self.cachedUser.role !== "temporary");
      };

      // qleeks made from a qleekDesc can't be modified, even if they belong to us
      self.isQleekContentEditable = function(qleek) {
        return (qleek.qleekDesc === null);
      }

      // can only edit a qleek's content if we can edit the qleek _and_ the content is editable
      self.canEditQleekContent = function(qleek) {
        return (self.canEditQleek(qleek) && self.isQleekContentEditable(qleek));
      };

      self.objectIsMine = function(object) {
        if (typeof object !== 'object' || !object.hasOwnProperty('owner')) {
          throw new Error('wrong object type: need owner field');
        }
        return self.cachedUser && self.documentsAreEqual(self.cachedUser._id, object.owner); 
      }

      // can only edit a qleek if it belongs to us and we're logged
      self.canEditQleek = self.objectIsMine;

      self.getCachedUser = function() { return self.cachedUser; }

      return _.pick(self, [
        "getToken", "setToken",
        "apiGet", "apiPost", "apiPut", "apiDelete",
        "login", "logout", "isLoggedIn",
        "getUserInfo", "updateUserInfo",
        "getCachedUser",
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
        "documentsAreEqual", "isQleekNew", "isDummyDocument",
        "isQleekContentEditable", "canEditQleek", "canEditQleekContent", "objectIsMine",
        ]);

      }
    });
} (window, angular));

var app = angular.module('qleekApiSample', ['qleek']);

app.config(function(qleekApiProvider) {
  console.log("config");
  qleekApiProvider.setURL("http://localhost:5001/api/v1/");
});

app.controller('userController', [ 'qleekApi', function($qleekApi) {
  var self = this;

  self.errorMessage = null;
  self.userName = null;

  self.inputEmail = "";
  self.inputPassword = "";

  self.click = function() {
    console.log("Try login with", self.inputEmail, "/", self.inputPassword);
    $qleekApi.login(self.inputEmail, self.inputPassword)
    .then(
      function success() {
        $qleekApi.getUserInfo()
        .then(
          function success(user) {
            self.userName = user.firstName + " " + user.lastName;
            self.errorMessage = null;
          },
          function reject() {
            self.userName = null;
            self.errorMessage = "Could not retrieve user info";
          }
        );
      },
      function reject() {
        self.errorMessage = "Login failed";
      }
    );
  }

}]);

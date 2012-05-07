(function()
{
  var passport = require("passport")
    , OAuth2Strategy = require("passport-google-oauth").OAuth2Strategy
    , config = require("../config")


  //Variable setup
  var NO_LOGIN_REQUIRED = false;

  var portString = '';
  if (config.EXT_PORT != 80) {
    portString = ':' + config.EXT_PORT;
  }

  var googleCallbackURI = 'http://' + config.HOSTNAME + portString + '/auth/google/callback';


  if ((process.argv.indexOf("--no-login") != -1) || (process.argv.indexOf("-nl") != -1)) {
    NO_LOGIN_REQUIRED = true;
    console.log("Logins are not required for this server.");
  }

  function validateEmail(email) {
    if (email) {
      for (var domain in config.ALLOWED_DOMAINS) {
        if (email.match(".*@" + config.ALLOWED_DOMAINS[domain] + "$")) {
          return true;
        }
      }
    }
    return false;
  }

  passport.serializeUser(function(user, done) {
    return done(null, user);
  });

  passport.deserializeUser(function(obj, done) {
    return done(null, obj);
  });

  var googleStrategy = new OAuth2Strategy(
    { clientID: config.CLIENT_ID
    , clientSecret: config.SECRET_KEY
    , callbackURL: googleCallbackURI
    }
    , function(access, refresh, profile, done)
    {
      for (id in profile.emails) {
        var email = profile.emails[id].value;

        if (validateEmail(email)) {
          return done(null, profile);
        }
      }

      return done(false, null);
    }
  );

  passport.use(googleStrategy);

  module.exports.authentication = function(redirectUrl) {
    return function(req, res, next) {
      if (NO_LOGIN_REQUIRED) {
        req.user = { "emails" : [ { "value" : "nologin@ironclad.mobi" } ] };
        return next();
      }

      if (req.isAuthenticated()) {
        return next();
      }
      
      res.redirect(redirectUrl);
    }
  };

  module.exports.profilescope = passport.authenticate('google',
    { scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'] }
  );

  module.exports.callback = passport.authenticate('google', { failureRedirect: "/login"});
  module.exports.initialize = function() { return passport.initialize(); };
  module.exports.session = function() { return passport.session(); };
}());

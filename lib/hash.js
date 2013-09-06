var Deferred = require('backbone-deferred');
var Backbone = require('backbone');
var debug = require('debug')('backbone-db-redis:hash');

var Hash = module.exports = Deferred.Model.extend({
  constructor: function() {
    Deferred.Model.apply(this, arguments);
  },
  hdel: function() {

  },
  hincrby: function() {

  },
  hmget: function(fields, opt) {
    var self = this;
    opt = opt || {};
    if(typeof cb === "undefined" && typeof cb === "function") {
      return this.hgetall(cb);
    }
    var db = this.db || this.collection.db;
    return this.defer('hmget', opt, function(cb) {
      var key = db.key(self.url());
      db.redis.hmget(key, fields, function(err, res) {
        self.set(res);
        cb(err, res);
      });
    });
  },
  hvals: function() {

  },
  hexists: function() {

  },
  hincrbyfloat: function() {

  },
  hmset: function(opt) {
    opt = opt || {};
    var self = this;
    var db = this.db || this.collection.db;
    return this.defer("hmset", function(cb) {
      db.redis.hmset(db.key(self.url()), self.attributes, cb);
    });
  },
  hget: function(field, opt) {
    var self = this;
    opt = opt || {};
    var db = this.db || this.collection.db;
    return this.defer('hget', opt, function(cb) {
      var key = db.key(self.url());
      db.redis.hget(key, field, function(err, res) {
        if(err) return cb(err);
        if(res) {
          self.set(field, res);
        }
        cb(null, res);
      });
    });
  },
  hkeys: function() {

  },
  hset: function(field, value, opt) {
    var self = this;
    opt = opt || {};
    var db = this.db || this.collection.db;

    return this.defer('hset', opt, function(cb) {
      var key = db.key(self.url());
      db.redis.hset(key, field, value, function(err, res) {
        if(res) {
          debug('set %s = %s',field, value);
          self.set(field, value);
        }
        cb(err, value);
      });
    });
  },
  hgetall: function() {

  },
  hlen: function() {

  },
  hsetnx: function() {

  },
  fetch: function(keys) {
    var self = this;
    return this.defer("fetch", function(cb) {
      self.hmget(keys, cb);
    });
  },
  save: function(opt) {
    opt = opt || {};
    var self = this;
    return this.defer("save", function(cb) {
      self.hmset(cb);
    });
  }
})
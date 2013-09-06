var Deferred = require('backbone-deferred');
var Backbone = require('backbone');
var debug = require('debug')('backbone-db-redis:set');
var _ = require('underscore');

var Set = module.exports = Deferred.Collection.extend({
  constructor: function() {
    Deferred.Collection.apply(this, arguments);
  },
  sadd: function(value) {

  },
  sinter: function() {

  },
  smove: function() {

  },
  sunion: function(collection, options) {
    var self = this;
    var db = this.db;
    if(!db) {
      db = this.model.db;
    }

    return this.defer('sunion', function(cb) {
      var src = db.key(self.url());
      var dst = db.key(collection.url());
      debug('redis sunion %s %s',src, dst);
      db.redis.sunion(src, dst, function(err, ids) {
        if(err || (!ids || ids.length == 0)) {
          return cb(err, ids);
        }
        var done = _.after(ids.length, cb.success);
        ids.forEach(function(id) {
          var model = new self.model({id:id})
          self.add(model);
          debug('fetching %s',id);
          model.fetch().done(done).fail(done);
        });
      });
    });
  },
  scard: function() {

  },
  sinterstore: function() {

  },
  spop: function() {

  },
  sunionstore: function() {

  },
  sdiff: function() {

  },
  sismember: function() {

  },
  srandmember: function() {

  },
  sdiffstore: function() {

  },
  smembers: function() {

  },
  srem: function() {

  }
});
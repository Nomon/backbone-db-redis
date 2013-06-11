var _ = require('underscore')
  , Backbone = require('backbone')
  , Db = require('backbone-db')
  , redis = require('redis');

/**
 * small redis string k=>v implementation
 */

function RedisDb(name) {
  this.name = name;
}

RedisDb.prototype.getItem = function(key, cb) {
  var client = exports.createClient();
  client.get(this.name+key, cb);
};

RedisDb.prototype.setItem = function(key, value, cb) {
  var client = exports.createClient();
  client.set(this.name+key, cb);
};

RedisDb.prototype.removeItem = function(key, cb) {
  var client = exports.createClient();
  client.del(this.name+key, cb);
};

/**
 * findAll backend
 */
RedisDb.prototype.findAll = function() {
  return _.chain(this.records)
    .map(function(id){
      var data = this.store().getItem(this.name+':'+id).done(function(data) {
        return data && JSON.parse(data);
      });
    }, this)
    .compact()
    .value();
}

var redisDb = new RedisDb();

_.extend(Db, {
 store: function() {
   return redisDb;
 }
});


// Override for custom client
//exports.createClient = function() {
 // return redis.createClient();
//};
module.exports = RedisDb;
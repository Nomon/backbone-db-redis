var _ = require('underscore')
  , Backbone = require('backbone')
  , Db = require('backbone-db')
  , redis = require('redis')
  , debug = require('debug')('backbone-db-redis');



Backbone.RedisDb = function(name, client) {
  this.name = name || "";
  this.redis = client;
  if(!this.redis) {
    debug('created default client');
    this.redis = redis.createClient();
  }
};

Backbone.RedisDb.sync = Db.sync

function getKey(model, options) {
  // collection
  debug('getKey');
  var key;
  if(model.url && typeof model.url == "function") {
    key = model.url();
  } else if(options.url) {
    key = typeof options.url == "function" ? options.url() : options.url;
  }
  return key;
}

_.extend(Backbone.RedisDb.prototype, Db.prototype, {
  findAll: function(model, options, callback) {
    debug('findAll');
    options = options || {};
    var key;
    if(options.url) {
      key = typeof options.url == "function" ? options.url() : options.url;
    } else if(model.url && typeof model.url == "function") {
      key = model.url();
    }
    var start = options.start || "0";
    var end = options.end || "-1";
    debug("redis sort "+key+ ' BY nosort GET '+this.name+':'+name+':*');
    this.redis.sort(key+ ' BY nosort GET '+this.name+':'+name+':*', callback);
  },
  find: function(model, options, callback) {
    var key = getKey(model, options);

    debug('find: '+key);
    this.redis.get(key, function(err, data) {
      debug('got: '+data);
      data = data && JSON.parse(data);
      callback(err, data);
    });
  },
  create: function(model, options, callback) {
    var self = this;
    var key = getKey(model, options);
    debug('Create '+key);
    console.log("create",model.toJSON());
    if (!model.id) {
      self.createId(model, options, function(err, id) {
        if(err || !id) {
          return callback(err);
        }
        key += id;
        model.set(model.idAttribute, id);
        self.redis.set(key, JSON.stringify(model.toJSON()), function(err, res) {
          callback(err, model.toJSON())
        });
      });
    } else {
      self.redis.set(key, JSON.stringify(model.toJSON()), function(err, res) {
        callback(err, model.toJSON())
      });
    }
  },
  createId: function(model, options, callback) {
    var key = getKey(model, options);
    key += 'ids';
    this.redis.incr(key, 1, callback);
  },
  update: function(model, options, callback) {
    var key = getKey(model, options);

    if(model.isNew()) {
      return this.create(model, options, callback);
    }
    debug('update: '+key);
    this.redis.set(key, JSON.stringify(model.toJSON()), function(err, res) {
      return callback(err, model.toJSON());
    });
  }
});


module.exports = Backbone.RedisDb;



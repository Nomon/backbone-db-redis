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

_.extend(Backbone.RedisDb.prototype, Db.prototype, {
  _getKey: function (model, options) {
    var key;
    if(model.url && typeof model.url == "function") {
      key = model.url();
    } else if(options.url) {
      key = typeof options.url == "function" ? options.url() : options.url;
    }
    return this.name + ':' + key;
  },
  findAll: function(model, options, callback) {
    debug('findAll');
    options = options || {};
    var key= this._getKey(model, options)
    var start = options.start || "0";
    var end = options.end || "-1";
    debug("redis sort "+key+ ' BY nosort GET '+key+':*');
    this.redis.sort(key+ ' BY nosort GET '+key+':*', function(err, res) {
      console.log('Sort got ',res);
      callback(err, res);
    });
  },
  find: function(model, options, callback) {
    var key = this._getKey(model, options);

    debug('find: '+key);
    this.redis.get(key, function(err, data) {
      data = data && JSON.parse(data);
      callback(err, data);
    });
  },
  create: function(model, options, callback) {
    var self = this;
    var key = this._getKey(model, options);
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
    var key = this._getKey(model, options);
    key += 'ids';
    this.redis.incr(key, 1, callback);
  },
  update: function(model, options, callback) {
    var key = this._getKey(model, options);
    var self = this;
    if(model.isNew()) {
      return this.create(model, options, callback);
    }
    debug('update: '+key);
    console.log(model);
    this.redis.set(key, JSON.stringify(model), function(err, res) {
      if(model.collection) {
        debug('adding model to '+model.url()+" to "+model.collection.url());
        self.redis.sadd(model.collection.url(), model.url(), function(err, res) {
          callback(err, model.toJSON());
        });
      } else {
        callback(err, model.toJSON());
      }
    });
  }
});


module.exports = Backbone.RedisDb;



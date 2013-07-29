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
  createClient: function() {
    var self = this;
    if(this.redis) {
      return redis.createClient(this.redis.port, this.redis.host);
    }
  },
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
    var start = options.start || "0";
    var end = options.end || "-1";
    var key = this._getKey(model, {});
    debug("redis sort "+key+ ' BY nosort GET '+key+':*');
    this.redis.sort(key+ ' BY nosort GET '+key+':*', function(err, res) {
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
    if (model.isNew()) {
      self.createId(model, options, function(err, id) {
        if(err || !id) {
          return callback(err);
        }
        model.set(model.idAttribute, id);
        self.update(model, options, callback);
      });
    } else {
      self.update(model, options, callback);
    }
  },
  createId: function(model, options, callback) {
    var key = this._getKey(model, options);
    key += ':ids';
    this.redis.incr(key, callback);
  },
  update: function(model, options, callback) {
    var key = this._getKey(model, options);
    var self = this;
    debug('update: '+key);
    if(model.isNew()) {
      return this.create(model, options, callback);
    }

    this.redis.set(key, JSON.stringify(model), function(err, res) {
      if(model.collection) {
        debug('adding model '+model.url()+" to "+model.collection.url());
        var setKey = self._getKey(model.collection, {});
        var modelKey = self._getKey(model, {});
        self.redis.zadd(setKey, Date.now(),modelKey, function(err, res) {
          callback(err, model.toJSON());
        });
      } else {
        callback(err, model.toJSON());
      }
    });
  }
});


module.exports = Backbone.RedisDb;



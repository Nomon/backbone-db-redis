var _ = require('underscore')
  , Backbone = require('backbone')
  , Db = require('backbone-db')
  , redis = require('redis')
  , debug = require('debug')('backbone-db-redis');



Backbone.RedisDb = function(name, client) {
  this.name = name || "";
  this.redis = client;
  if(!this.redis) {
    this.redis = redis.createClient();
  }
};

Backbone.RedisDb.prototype.key = function(key) {
  if(this.name == "") {
    return key;
  } else {
    return this.name + ':' + key;
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
  findAll: function(model, options, callback) {
    debug('findAll '+model.url());
    options = options || {};
    var collectionKey = this._getKey(model, options);
    if(model.model) {
      var m = new model.model();
      var modelKey = this._getKey(m, {});
      var start = options.start || "0";
      var end = options.end || "-1";
      var key = this._getKey(model, {});
      debug("redis sort "+collectionKey+ ' BY nosort GET '+modelKey+':*');
      this.redis.sort(collectionKey, "BY", "nosort" ,"GET", modelKey+':*', function(err, res) {
        if(res) {
          res = res.map(function(data) {
            return data && JSON.parse(data);
          });
        }
        callback(err, res);
      });
    } else {
      this.redis.get(collectionKey, function(err, data) {
        data = data && JSON.parse(data);
        callback(err, data);
      });
    }
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
        var setKey = self._getKey(model.collection, {});
        var modelKey = model.get(model.idAttribute);
        debug('adding model '+modelKey+" to "+setKey);
        self.redis.sadd(setKey, modelKey, function(err, res) {
          callback(err, model.toJSON());
        });
      } else {
        callback(err, model.toJSON());
      }
    });
  }
});


var types = require('./lib');
Backbone.RedisDb.Set = types.Set;
Backbone.RedisDb.SortedSet = types.SortedSet;
Backbone.RedisDb.Hash = types.Hash;
Backbone.RedisDb.List = types.List;
module.exports = Backbone.RedisDb;



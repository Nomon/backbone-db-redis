var _ = require('underscore')
  , Backbone = require('backbone')
  , Db = require('backbone-db')
  , redis = require('redis')
  , debug = require('debug')('backbone-db-redis')
  , indexing = require('./lib/indexing')
  , query = require('./lib/query');


Backbone.RedisDb = function(name, client) {
  this.name = name || "";
  this.redis = client;
  if(!this.redis) {
    this.redis = redis.createClient();
  }
};

Backbone.RedisDb.prototype.key = function(key) {
  if(this.name === "") {
    return key;
  } else {
    return this.name + ':' + key;
  }
};

Backbone.RedisDb.sync = Db.sync;

_.extend(Backbone.RedisDb.prototype, Db.prototype, {
  createClient: function() {
    var self = this;
    if(this.redis) {
      return redis.createClient(this.redis.port, this.redis.host);
    }
  },
  _getKey: function (model, options) {
    var key = '';

    if(options.url) {
      key = typeof options.url === "function" ? options.url() : options.url;
    } else if(model.url) {
      key = typeof model.url === "function" ? model.url() : model.url;
    }  else if(model.id) {
      key = model.id;
    }
    return this.name + (key ? ':' + key : '');
  },
  findAll: function(model, options, callback) {
    debug('findAll '+model.url());
    options = options || {};
    var collectionKey = this._getKey(model, options);
    if(model.model) {
      var m = new model.model();
      var modelKey = this._getKey(m, {});
      var dbOpts = {
        db: this,
        model: model,
        modelKey: modelKey,
        collectionKey: collectionKey,
        indexes: m.indexes
      };
      query.queryModels(options, dbOpts, callback);
    } else {
      this.redis.get(collectionKey, function(err, data) {
        data = data && JSON.parse(data);
        callback(err, data);
      });
    }
  },
  find: function(model, options, callback) {
    var key = this._getKey(model, options);

    debug('find: ' + key);
    this.redis.get(key, function(err, data) {
      data = data && JSON.parse(data);
      callback(err, data);
    });
  },
  create: function(model, options, callback) {
    var self = this;
    var key = this._getKey(model, options);
    debug('create: ' + key);
    if (model.isNew()) {
      self.createId(model, options, function(err, id) {
        if(err || !id) {
          return callback(err || new Error('id is missing'));
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
          self._updateIndexes(model, options, callback);
        });
      } else {
        self._updateIndexes(model, options, callback);
      }
    });
  },
  destroy: function(model, options, callback) {
    var self = this;
    var key = this._getKey(model, options);
    debug("DESTROY: " + key);
    if (model.isNew()) {
      return false;
    }

    function delKey() {
      debug('removing key: ' + key);
      self.redis.del(key, function(err, res) {
        callback(err, model.toJSON());
      });
    }

    this._updateIndexes(model, _.extend({operation: 'delete'}, options), function(err) {
      if(model.collection) {
        var setKey = self._getKey(model.collection, {});
        var modelKey = model.get(model.idAttribute);
        debug('removing model ' + modelKey + " from " + setKey);
        self.redis.srem(setKey, modelKey, function(err, res) {
          if(err) return callback(err);
          delKey();
        });
      } else {
        debug('model has no collection specified');
        delKey();
      }
    });
  },

  addToIndex: function(collection, model, options, cb) {
    var setKey = collection.indexKey;
    var key = model.id;
    debug('adding model ' + key + ' to ' + setKey);
    if(collection.indexSort) {
      this.redis.zadd(setKey, collection.indexSort(model), key, cb);
    } else {
      this.redis.sadd(setKey, key, function(err, res) {
        cb(err, res);
      });
    }
  },

  readFromIndex: function(collection, options, cb) {
    var done = function(err, keys) {
      var models = [];
      _.each(keys, function(id) {
        models.push({id: id});
      });
      collection.set(models, options);
      return cb(err, models);
    };

    var setKey = collection.indexKey;
    var readFn = collection.indexSort
      ? _.bind(this.redis.zrange, this.redis, setKey, 0, -1)
      : _.bind(this.redis.smembers, this.redis, setKey);
    debug('reading keys from: ' + setKey);
    readFn(done);
  },


  removeFromIndex: function(collection, models, options, cb) {
    var setKey = collection.indexKey;
    var keys = _.pluck(models, models[0].idAttribute);
    var cmd = [setKey].concat(keys);
    debug('removing key: ' + keys +' from: ' + setKey);
    if(collection.indexSort) {
      this.redis.zrem(cmd, cb);
    } else {
      this.redis.srem(cmd, cb);
    }
  },

  existsInIndex: function(collection, model, options, cb) {
    var setKey = collection.indexKey;
    var key = model.id;
    debug('check existance for: ' + key + ' in: ' + setKey);

    function done(err, rank) {
      cb(err, rank !== null);
    }

    if(collection.indexSort) {
      this.redis.zrank(setKey, key, done);
    } else {
      this.redis.sismember(setKey, key, function(err, isMember) {
        cb(err, isMember === 1);
      });
    }
  },

  indexCount: function(collection, options, cb) {
    var setKey = collection.indexKey;
    debug('get count for: ' + setKey);
    if(collection.indexSort) {
      this.redis.zcard(setKey, cb);
    } else {
      this.redis.scard(setKey, cb);
    }
  },

  findKeys: function(collection, options, cb) {
    var prefix = options.prefix || (this.name + ':');
    this.redis.keys(prefix + options.keys + '*', cb);
  },

  _updateIndexes: function(model, options, callback) {
    if(!model.indexes) {
      debug('nothing to index');
      return callback(null, model.toJSON());
    }
    var operation = options.operation || 'add';
    var indexingOpts = {
      db: this,
      indexes: model.indexes,
      data: model.attributes,
      prevData: operation === 'delete' ? model.attributes : model.previousAttributes(),
      operation: operation,
      baseKey: model.collection ? model.collection.type : model.type,
      id: model.id
    };
    indexing.updateIndexes(indexingOpts, callback);
  }
});

Backbone.RedisDb.Set = require('./lib/set');
Backbone.RedisDb.Hash = require('./lib/hash');
module.exports = Backbone.RedisDb;



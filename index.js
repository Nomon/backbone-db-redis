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
        collectionKey: collectionKey
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

    if(model.collection) {
      var setKey = self._getKey(model.collection, {});
      var modelKey = model.get(model.idAttribute);
      this._updateIndexes(model, _.extend({operation: 'delete'}, options), function(err) {
        debug('removing model ' + modelKey + " from " + setKey);
        self.redis.srem(setKey, modelKey, function(err, res) {
          if(err) return callback(err);
          delKey();
        });
      });
    } else {
      debug('model has no collection specified');
      delKey();
    }
  },
  _updateIndexes: function(model, options, callback) {
    if(!model.indexedAttributes) {
      debug('nothing to index');
      return callback(null, model.toJSON());
    }
    var operation = options.operation || 'add';
    var indexingOpts = {
      db: this,
      indexes: model.indexedAttributes,
      data: model.attributes,
      prevData: operation === 'delete' ? model.attributes : model.changedAttributes(),
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



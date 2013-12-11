var _ = require('underscore');
var debug = require('debug')('backbone-db-redis:query');

function getKey(db, baseKey, key, val) {
  return db.name + ':i:' + baseKey + ':' + key + ':' + val;
}

function toJSON(res) {
  if(res) {
    res = res.map(function(data) {
      return data && JSON.parse(data);
    });
  }
  return res;
}

var DbQuery = function(dbOptions, filterOptions, callback) {
  this.dbOptions = dbOptions;
  this.filterOptions = filterOptions;
  this.db = dbOptions.db;
  this.requiredIndexes = [];
  _.each(filterOptions.where, function(val, key) {
    this.requiredIndexes.push(getKey(this.db, dbOptions.model.type, key, val));
  }, this);
  debug('searching', filterOptions.where, 'from', this.requiredIndexes);
};

_.extend(DbQuery.prototype, {
  execute: function(callback) {
    if(this.filterOptions.where) return this.filterModels(callback);
    else return this.allModels(callback);
  },

  filterModels: function(callback) {
    var self = this;
    this.db.redis.sinter(this.requiredIndexes, function(err, ids) {
      self.searchByIds(ids, {}, callback);
    });
  },

  searchByIds: function(ids, options, callback) {
    var keys = ids.map(function(id) {
      return 'test:mymodel:' + id;
    });
    var query = keys.map(function (key) {
      return ['GET', key];
    });
    this.db.redis
      .multi(query)
      .exec(function(err, res) {
        callback(err, toJSON(res));
      });
  },

  allModels: function(callback) {
    var collectionKey = this.dbOptions.collectionKey;
    var modelKey = this.dbOptions.modelKey;
    debug("redis sort " + collectionKey + ' BY nosort GET ' + modelKey+':*');
    this.db.redis.sort(collectionKey, "BY", "nosort" ,"GET", modelKey + ':*', function(err, res) {
      callback(err, toJSON(res));
    });
  }
});

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var query = new DbQuery(dbOptions, filterOptions, callback);
  query.execute(callback);
};
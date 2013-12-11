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

var DbQuery = function(dbOptions, filterOptions) {
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
    var self = this;
    this.multi = this.db.redis.multi();
    if(this.filterOptions.where) this.filterModels();
    else this.allModels();
    this.multi.exec(function(err, ids) {
      self.searchByIds(ids[0], callback);
    });
  },

  filterModels: function() {
    var self = this;
    this.multi.sinter(this.requiredIndexes);
  },

  searchByIds: function(ids, callback) {
    if(!ids.length) return callback(null, []);
    var keys = _.map(ids, function(id) {
      return this.dbOptions.modelKey + ':' + id;
    }, this);
    this.db.redis.mget(keys, function(err, res) {
      callback(err, toJSON(res));
    });
  },

  allModels: function() {
    var collectionKey = this.dbOptions.collectionKey;
    var modelKey = this.dbOptions.modelKey;
    debug("redis sort " + collectionKey + ' BY nosort GET ' + modelKey+':*');
    this.multi.sort(collectionKey, "BY", "nosort");
  }
});

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var query = new DbQuery(dbOptions, filterOptions);
  query.execute(callback);
};
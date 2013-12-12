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
  this.limit = this.filterOptions.limit ? this.filterOptions.limit : 50;
  this.offset = this.filterOptions.offset ? this.filterOptions.offset : 0;
  debug('searching', filterOptions.where, 'from', this.requiredIndexes);
};

_.extend(DbQuery.prototype, {
  execute: function(callback) {
    var self = this;
    this.multi = this.db.redis.multi();
    this.destinationSet = 'temp' + (Date.now() * Math.random());
    if(this.filterOptions.where) this.filterModels();
    else this.allModels();
    //if(this.filterOptions.limit)
    this.multi.del(this.destinationSet);
    this.multi.exec(function(err, results) {
      var ids = results[self.idQueryNr];
      self.searchByIds(ids, callback);
    });
  },

  filterModels: function() {
    var self = this;
    var query = this.requiredIndexes;
    if(query.length > 1) {
      query.unshift(this.limit);
      query.unshift(this.destinationSet);
      this.multi.zinterstore(query);
      this.multi.zrange(this.destinationSet, 0, -1);
      this.idQueryNr = 1;
    } else {
      this.multi.zrange(query[0], 0, -1);
      this.idQueryNr = 0;
    }
  },

  searchByIds: function(ids, callback) {
    if(!ids.length) return callback(null, []);
    ids = ids.splice(this.offset, this.limit);
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
    this.multi.sort(collectionKey, 'BY', 'nosort');
    this.idQueryNr = 0;
  }
});

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var query = new DbQuery(dbOptions, filterOptions);
  query.execute(callback);
};
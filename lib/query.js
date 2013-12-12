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
      this.multi.smembers(query[0]);
      this.idQueryNr = 0;
    }
  },

  searchByIds: function(ids, callback) {
    if(!ids.length) return callback(null, []);
    //TODO: already apply limit & offset on query
    ids = ids.splice(this.offset, this.limit);
    var keys = _.map(ids, function(id) {
      return this.dbOptions.modelKey + ':' + id;
    }, this);
    this.db.redis.mget(keys, function(err, res) {
      callback(err, toJSON(res));
    });
  },

  allModels: function() {
    //console.log(this.filterOptions.sort, this.dbOptions.indexes);
    var sort = this.filterOptions.sort;

    var collectionKey = this.dbOptions.collectionKey;
    var modelKey = this.dbOptions.modelKey;
    if(!sort) {
      debug("redis sort " + collectionKey + ' BY nosort GET ' + modelKey+':*');
      this.multi.sort(collectionKey, 'BY', 'nosort');
      this.idQueryNr = 0;
    } else {
      this.sort(sort);
    }
  },

  sort: function(sortProp) {
    var sortOrder = 1;
    if(sortProp && sortProp[0] === "-") {
      sortOrder = -1;
      sortProp = sortProp.substr(1);
    }
    var sortKey = this.db.name + ':i:' + this.dbOptions.model.type + ':' + sortProp;
    if(sortOrder === 1) this.multi.zrange(sortKey, 0, -1);
    else this.multi.zrevrange(sortKey, 0, -1);
    this.idQueryNr = 0;
  }
});

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var query = new DbQuery(dbOptions, filterOptions);
  query.execute(callback);
};
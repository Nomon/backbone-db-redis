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
  this.limit = this.filterOptions.limit ? this.filterOptions.limit : 50;
  this.offset = this.filterOptions.offset ? this.filterOptions.offset : 0;
  debug('searching', filterOptions.where, 'from', this.requiredIndexes);
};

_.extend(DbQuery.prototype, {
  execute: function(callback) {
    var self = this;
    this.multi = this.db.redis.multi();
    if(this.filterOptions.where) {
      this.filterModels();
    } else {
      this.fetchAll();
    }

    if(this.destinationSet) this.multi.del(this.destinationSet);
    this.multi.exec(function(err, results) {
      var ids = results[self.idQueryNr];
      self.searchByIds(ids, callback);
    });
  },

  filterModels: function() {
    var self = this;
    this.requiredIndexes = [];
    _.each(this.filterOptions.where, function(val, key) {
      this.requiredIndexes.push(getKey(this.db, this.dbOptions.model.type, key, val));
    }, this);

    var query = this.requiredIndexes;
    this.destinationSet = 'temp' + (Date.now() * Math.random());

    if(query.length > 1) {
      query.unshift(this.limit);
      query.unshift(this.destinationSet);
      this.multi.zinterstore(query);
      this.multi.zrange(this.destinationSet, 0, -1);
      this.idQueryNr = 1;
    } else {
      if(this.filterOptions.sort) {
        this.idQueryNr = 1;
        var sortOpts = this._getSortKeyAndOrder();
        query.unshift(this.limit);
        query.unshift(this.destinationSet);
        query.push(sortOpts.sortKey);
        this.multi.zinterstore(query);
        this._fetchSorted(this.destinationSet);
      } else {
        this.idQueryNr = 0;
        this.multi.smembers(query[0]);
      }
    }
  },

  fetchAll: function() {
    if(!this.idQueryNr) this.idQueryNr = 0;
    if(!this.filterOptions.sort) {
      var collectionKey = this.dbOptions.collectionKey;
      var modelKey = this.dbOptions.modelKey;
      this.multi.sort(collectionKey, 'BY', 'nosort');
    } else {
      this._fetchSorted();
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


  _fetchSorted: function(set) {
    var sortOpts = this._getSortKeyAndOrder();
    set = set ? set : sortOpts.sortKey;
    if(sortOpts.sortOrder === 1) this.multi.zrange(set, 0, -1);
    else this.multi.zrevrange(set, 0, -1);
  },

  _getSortKeyAndOrder: function() {
    var sortProp = this.filterOptions.sort;
    var sortOrder = 1;
    if(sortProp && sortProp[0] === "-") {
      sortOrder = -1;
      sortProp = sortProp.substr(1);
    }
    var sortKey = this.db.name + ':i:' + this.dbOptions.model.type + ':' + sortProp;
    return {
      sortKey: sortKey,
      sortOrder: sortOrder
    };
  }
});

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var query = new DbQuery(dbOptions, filterOptions);
  query.execute(callback);
};
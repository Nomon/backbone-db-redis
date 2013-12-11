var _ = require('underscore');
var debug = require('debug')('backbone-db-redis:query');

function getKey(db, baseKey, key, val) {
  return db.name + ':i:' + baseKey + ':' + key + ':' + val;
}

exports.queryModels = function(filterOptions, dbOptions, callback) {
  var db = dbOptions.db;
  if(!filterOptions.where) return callback(null, []);

  var searchByIds = function(ids, options, callback) {
    var keys = ids.map(function(id) {
      return 'test:mymodel:' + id;
    });
    var query = keys.map(function (key) {
      return ['GET', key];
    });
    db.redis
      .multi(query)
      .exec(function(err, res) {
        if(res) {
          res = res.map(function(data) {
            return data && JSON.parse(data);
          });
        }
        callback(err, res);
      });
  };

  var requiredIndexes = [];
  _.each(filterOptions.where, function(val, key) {
    requiredIndexes.push(getKey(db, dbOptions.model.type, key, val));
  });
  debug('searching', filterOptions.where, 'from', requiredIndexes);
  db.redis.sinter(requiredIndexes, function(err, ids) {
    searchByIds(ids, {}, callback);
  });
};


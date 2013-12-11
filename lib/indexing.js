var debug = require('debug')('backbone-db-redis:indexing');

function getKey(db, baseKey, key, val) {
  return db.name + ':i:' + baseKey + ':' + key + ':' + val;
}

/**
params:
  options object:
  {
    indexes - array of properties to be indexed
    data - model.attributes
    prevData - model's previous attributes
    baseKey - model's identification string
    id - model's id
    db - RedisDb instance
  }
**/
exports.updateIndexes = function (options, callback) {
  var queue = [];
  var indexes = options.indexes;
  var data = options.data;
  var prevData = options.prevData;
  var baseKey = options.baseKey;
  var id = options.id;
  var db = options.db;
  var operation = options.operation;
  var val;

  indexes.forEach(function (key) {
    if(operation === 'add' && data.hasOwnProperty(key)) {
      val = data[key];
      queue.push([
        'SADD',
        getKey(db, baseKey, key, val),
        id
      ]);
    }
    // value was changed or deleting object
    if((operation === 'add' && prevData && prevData[key] !== data[key]) ||
      (operation === 'delete' && prevData && prevData.hasOwnProperty(key))) {
      val = prevData[key];
      queue.push([
        'SREM',
        getKey(db, baseKey, key, val),
        id
      ]);
    }
  });

  if(queue.length) {
    debug('updating indexes:', queue);
    db.redis
      .multi(queue)
      .exec(function (err) {
        callback(err, data);
      });
  } else {
    debug('no indexes need updating');
    callback(null);
  }
};

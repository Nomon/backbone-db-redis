var _ = require('underscore');
var RedisDb = require('../');
var Backbone = require('backbone');
var Promises = require('backbone-promises');
var Model = Promises.Model;
var Collection = Promises.Collection;
var store = new RedisDb('test');
var redis = require('redis');

var MyModel = exports.MyModel = Model.extend({
  db: store,
  sync: RedisDb.sync,
  url: function() {
    var key = 'mymodel';
    if(!this.isNew()) {
      key += ':' + this.get(this.idAttribute);
    }
    return key;
  }
});

var MyCollection = exports.MyCollection = Collection.extend({
  db: store,
  sync: RedisDb.sync,
  model: MyModel,
  url: function() {
    return 'mymodels';
  }
});

exports.clearDb = function(cb) {
  var client = redis.createClient();
  client.keys('test:mymodel*', function(err, keys) {
    keys.forEach(function(key) {
      client.del(key);
    });
    cb();
  });
};
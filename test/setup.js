var _ = require('underscore');
var RedisDb = require('../');
var Backbone = require('backbone');
var Promises = require('backbone-promises');
var Model = Promises.Model;
var Collection = Promises.Collection;
var store = exports.store = new RedisDb('test');
var redis = require('redis');

var MyModel = exports.MyModel = Model.extend({
  db: store,
  sync: RedisDb.sync,
  type: 'mymodel',
  url: function() {
    var key = this.type;
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
  type: 'mymodels',
  url: function() {
    return this.type;
  }
});

var IndexedModel = exports.IndexedModel = MyModel.extend({
  indexes: [
    {property: 'value', sort: 'asc'},
    {property: 'name'}
  ]
});

var IndexedCollection = exports.IndexedCollection = MyCollection.extend({
  model: IndexedModel
});

var fixtures = [
  {id: 1, value: 1, name: 'a'},
  {id: 2, value: 2, name: 'b'},
  {id: 3, value: 3, name: 'c'},
  {id: 4, value: 2, name: 'c'},
];

exports.insertFixtureData = function (collection, cb) {
  var fns = [];
  _.each(fixtures, function(row) {
    fns.push(collection.create(row));
  });

  Promises.when.all(fns)
    .then(function() {
      cb(null);
    })
    .otherwise(function(err) {
      cb(err);
    });
};

exports.clearDb = function(cb) {
  var client = redis.createClient();
  client.keys('test:*', function(err, keys) {
    keys.forEach(function(key) {
      client.del(key);
    });
    cb();
  });
};
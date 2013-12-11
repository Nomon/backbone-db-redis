var assert = require('assert');
var _ = require('underscore');
var Promises = require('backbone-promises');

var setup = require('./setup');
var redis = setup.store.redis;

var collection = new setup.IndexedCollection();

describe('Indexing tests', function() {
  var testModel;

  before(function(done) {
    setup.insertFixtureData(collection, done);
  });

  after(function(done) {
    setup.clearDb(function(err) {
      done(err);
    });
  });

  it('should check that specified indexes were created', function(done) {
    redis.keys('test:i:mymodel*', function(err, keys) {
      assert(keys.indexOf('test:i:mymodels:value:1') > -1);
      redis.smembers('test:i:mymodels:value:2', function(err, ids) {
        assert(ids.indexOf('2') > -1);
        assert(ids.indexOf('4') > -1);
        done();
      });
    });
  });

  it('should fetch all models', function(done) {
    collection
      .fetch()
      .then(function() {
        done();
      });
  });

  it('should remove indexes when removing models', function(done) {
    function checkIndexes() {
      redis.keys('test:i:mymodel*', function(err, keys) {
        assert(keys.indexOf('test:i:mymodels:value:1') === -1);
        done();
      });
    }

    var model = collection.findWhere({id: 1});
    assert(model);
    model
      .destroy()
      .then(function() {
        checkIndexes();
      })
      .otherwise(done);
  });

  it('should remove reference to model in index after removing', function(done) {
    function checkIndexes() {
      redis.keys('test:i:mymodel*', function(err, keys) {
        assert(keys.indexOf('test:i:mymodels:value:2') > -1);
        assert(keys.indexOf('test:i:mymodels:name:b') === -1);
        redis.smembers('test:i:mymodels:value:2', function(err, ids) {
          assert(ids.indexOf('2') === -1);
          assert(ids.indexOf('4') > -1);
          done();
        });
      });
    }

    var model = collection.findWhere({id: 2});
    assert(model);
    model
      .destroy()
      .then(function() {
        checkIndexes();
      })
      .otherwise(done);
  });
});

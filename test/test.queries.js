var assert = require('assert');
var _ = require('underscore');
var Promises = require('backbone-promises');

var setup = require('./setup');
var redis = setup.store.redis;

var collection = new setup.IndexedCollection();

describe('Query tests', function() {
  var testModel;

  before(function(done) {
    setup.insertFixtureData(collection, done);
  });

  after(function(done) {
    setup.clearDb(function(err) {
      done(err);
    });
  });

  it('should fetch matching models filtered with where operator', function(done) {
    var opts = {
      where: {
        value: 2
      }
    };
    collection
      .fetch(opts)
      .then(function() {
        assert(collection.length === 2);
        var allHaveCorrectValue = collection.all(function(model) {
          return model.get('value') === 2;
        });
        assert(allHaveCorrectValue);
        done();
      }).otherwise(done);
  });

  it('should fetch models with limit & offset', function(done) {
    var opts = {
      limit: 2,
      offset: 1,
    };
    collection
      .fetch(opts)
      .then(function() {
        assert(collection.length === 2);
        var m = collection.at(0);
        assert(m.get('id') === 2);
        done();
      }).otherwise(done);
  });

  it('should fetch models reverse sorted with value', function(done) {
    var opts = {
      sort: '-value'
    };
    collection
      .fetch(opts)
      .then(function() {
        assert(collection.length === 4);
        done();
      }).otherwise(done);
  });

});

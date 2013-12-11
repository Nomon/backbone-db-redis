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

});

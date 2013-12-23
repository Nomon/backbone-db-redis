var assert = require('assert');
var _ = require('underscore');
var nodefn = require('when/node/function');
var Promises = require('backbone-promises');
var when = Promises.when;
var setup = require('./setup');
var MyCollection = setup.MyCollection;
var MyModel = setup.MyModel;
var store = setup.store;

var TestCollection = MyCollection.extend({
  indexDb: store,
  indexKey: 'test:i:Foo:relation',
  indexSort: function(model) {
    return Date.now();
  },

  addToIndex: function(model, options) {
    options = options ? _.clone(options) : {};
    if (!(model = this._prepareModel(model, options))) return false;
    if (!options.wait) this.add(model, options);
    options.indexKey = this.indexKey;
    return nodefn.call(_.bind(this.indexDb.addToIndex, this.indexDb), this, model, options);
  },

  readFromIndex: function(options) {
    options = options ? _.clone(options) : {};
    options.indexKey = this.indexKey;
    return nodefn.call(_.bind(this.indexDb.readFromIndex, this.indexDb), this, options);
  }
});

describe('Test IndexedCollection', function () {
  var collection;

  before(function(done) {
    collection = new TestCollection();
    var fns = [
      collection.create({data: 'aaa'}),
      collection.create({data: 'bbb'})
    ];
    when.all(fns).then(function() {
      done();
    }).otherwise(done);
  });

  after(function(done) {
    setup.clearDb(done);
  });

  it('should index a new item', function(done) {
    collection
      .addToIndex(collection.at(0))
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('should index another item', function(done) {
    collection
      .addToIndex(collection.at(1))
      .then(function() {
        done();
      }).otherwise(done);
  });

  it('should read ids from index', function(done) {
    collection = new TestCollection();
    collection
      .readFromIndex()
      .then(function() {
        assert.equal(collection.length, 2);
        assert.equal(collection.pluck('id').length, 2);
        done();
      }).otherwise(done);
  });

  it('should fetch models', function(done) {
    collection = new TestCollection();
    collection
      .fetch()
      .then(function() {
        assert.equal(collection.length, 2);
        assert.equal(collection.at(0).get('data'), 'aaa');
        done();
      }).otherwise(done);
  });
});
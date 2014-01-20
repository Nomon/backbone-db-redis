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
    return model.get('score');
  },

  /**
   * Adds a new model to the index. Only specified attribute is indexed.
   * Db adapter returns a Promise
   */
  addToIndex: function(model, options) {
    options = options ? _.clone(options) : {};
    if (!(model = this._prepareModel(model, options))) return false;
    if (!options.wait) this.add(model, options);
    return this._callAdapter('addToIndex', options, model);
  },

  /**
   * Read model ids from the index. Populates collection models with ids,
   * for fetching from the main storage.
   */
  readFromIndex: function(options) {
    return this._callAdapter('readFromIndex', options);
  },

 /**
   * Removes a model from index
   */
  removeFromIndex: function(models, options) {
    if(!models) return false;
    this.remove(models, options);
    var singular = !_.isArray(models);
    models = singular ? [models] : _.clone(models);
    return this._callAdapter('removeFromIndex', options, models);
  },

  /**
   *  Check if model exists in index
   */
  exists: function(model, options) {
    return this._callAdapter('existsInIndex', options, model);
  },

  /**
   * Get count of items in index
   */
  count: function(options) {
    return this._callAdapter('indexCount', options);
  },

  findKeys: function(keys, options) {
    options = options ? _.clone(options) : {};
    options.keys = keys;
    return this._callAdapter('findKeys', options);
  },

  _callAdapter: function(fn, options, models) {
    options = options ? _.clone(options) : {};
    if(!this.indexDb) {
      throw new Error('indexDb must be defined');
    }
    options.indexKey = this.indexKey;
    var args = [this, options];
    if(models) args.splice(1, 0, models);
    return nodefn.apply(_.bind(this.indexDb[fn], this.indexDb), args);
  }
});

describe('Test IndexedCollection', function () {
  var collection;

  before(function(done) {
    collection = new TestCollection();
    var fns = [
      collection.create({data: 'aaa', score: 22}),
      collection.create({data: 'bbb', score: 1}),
      collection.create({data: 'ccc', score: 99})
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

  it('should index another item', function(done) {
    collection
      .addToIndex(collection.at(2))
      .then(function() {
        done();
      }).otherwise(done);
  });


  it('should get count from index', function(done) {
    collection = new TestCollection();
    collection
      .count()
      .then(function(count) {
        assert.equal(count, 3);
        done();
      }).otherwise(done);
  });

  it('should read ids from index', function(done) {
    collection = new TestCollection();
    collection
      .readFromIndex()
      .then(function() {
        assert.equal(collection.length, 3);
        assert.equal(collection.pluck('id').length, 3);
        done();
      }).otherwise(done);
  });

  it('should fetch models', function(done) {
    var fetchOpts = {
      where: {
        id: {
          $in: collection.pluck('id')
        }
      }
    };
    collection
      .fetch(fetchOpts)
      .then(function() {
        assert.equal(collection.length, 3);
        assert.equal(collection.at(0).get('data'), 'ccc');
        assert.equal(collection.at(1).get('data'), 'aaa');
        done();
      }).otherwise(done);
  });

  it('should check that model exists in index', function(done) {
    var model = collection.at(0);
    assert(model);
    collection
      .exists(model)
      .then(function(exists) {
        assert.equal(exists, true);
        done();
      }).otherwise(done);
  });

  it('should fetch keys starting with given string', function(done) {
    collection
      .findKeys('i:Foo:')
      .then(function(keys) {
        assert.equal(keys.length, 1);
        done();
      }).otherwise(done);
  });

  it('should remove model from index', function(done) {
    var model = collection.at(0);
    assert(model);
    collection
      .removeFromIndex(model)
      .then(function() {
        assert.equal(collection.length, 2);
        done();
      }).otherwise(done);
  });

  it('should check that model was removed from index', function(done) {
    collection = new TestCollection();
    collection
      .readFromIndex()
      .then(function() {
        assert.equal(collection.length, 2);
        assert(collection.at(0).get('data') !== 'ccc');
        done();
      }).otherwise(done);
  });

});
var assert = require('assert');
var _ = require('underscore');
var RedisDb = require('../');
var Backbone = require('backbone');
var Promises = require('backbone-promises');
var Model = Promises.Model;
var Collection = Promises.Collection;
var store = new RedisDb('test');

var MyModel = Model.extend({
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

var MyCollection = Collection.extend({
  db: store,
  sync: RedisDb.sync,
  model: MyModel,
  url: function() {
    return 'mymodels';
  }
});

var testCol = new MyCollection();

describe('RedisDB', function() {
  describe('#Collection', function() {
    var testModel;

    it('should be able to create', function(t) {
      testCol.create({'id_check': 1},{ wait: true }).then(function(m) {
          assert(m.get('id_check') === testCol.at(0).get('id_check'));
          var m2 = new MyModel({id: m.id});
          m2.fetch().then(function() {
            assert(m.get('id_check') === m2.get('id_check'));
            t();
          }).otherwise(function(err) {
            console.error(err);
            throw err;
          });
        }).otherwise(function(err) {
          throw err;
        });
    });
    it('should save & load its member urls to its set', function(t) {
      var a = new MyCollection();
      a.fetch().then(function(c, a) {
        //assert(c.at(0) != null);
        t();
      });
    });
    it('should have deferred .create', function(t) {
      var a = new MyCollection();
      a.create({data:"xyz"}).then(function(m) {
        testModel = m;
        assert(m.get("data") == "xyz");
        t();
      });
    });

    it('should have deferred .fetch', function(t) {
      var a = new MyCollection();
      a.fetch().then(function() {
        t();
      });
    });

    it('should remove model from collection', function(t) {
      var testId = testModel.id;
      testModel.destroy({
        success: function() {
          var a = new MyCollection();
          a.fetch().then(function() {
            var removedModel = a.where({id: testId});
            assert(removedModel.length === 0);
            t();
          });

        },
        error: function(err) {
          assert(false);
          t();
        }
      });
    });

  });
});
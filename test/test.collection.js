var assert = require('assert');
var _ = require('underscore');
var RedisDb = require('../');
var Backbone = require('backbone');
var Deferred = require('backbone-deferred');
var Model = Deferred.Model;
var Collection = Deferred.Collection;
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
    it('should be able to create', function(t) {
      var m = testCol.create({id:1,"id_check":1});
      console.log(m);
      m.save().done(function() {
        assert(m.get('id_check') == testCol.at(0).get('id_check'));
        var m2 = new MyModel({id:1});
        m2.fetch().done(function() {
          assert(m.get('id_check') == m2.get('id_check'));
          t();
        });
      });
    });
    it('should save & loadits member urls to its set', function(t) {
      var a = new MyCollection();
      a.fetch().done(function(c, a) {
        console.log(c, a);
        //assert(c.at(0) != null);
        t();
      });
    });
  });
});
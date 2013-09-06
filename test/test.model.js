var assert = require('assert');
var _ = require('underscore');
var RedisDb = require('../');
var Backbone = require('backbone');
var Model = require('backbone-deferred').Model;

var store = new RedisDb('mymodel');

var MyModel = Model.extend({
  db: store,
  sync: RedisDb.sync,
  url: function() {
    var key = 'mymodel';
    if(!this.isNew()) {
      key += ':' + this.id;
    }
    return key;
  }
});


describe('RedisDB', function() {
  describe('#Model', function() {
    it('should .save from store', function(t) {
      var m = new MyModel({id:1, "asd":"das"});
      m.db = store;
      m.save().done(function() {
        var m2 = new MyModel({id:1});
        m2.fetch().done(function() {
          assert.equal(m2.get("asd"),"das");
          t();
        });
      });
    });
  });
});
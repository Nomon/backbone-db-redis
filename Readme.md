## Usage

```js

var store = new RedisDb('mymodel', redis.createClient());

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

var a = new MyModel({id:"1"});

a.fetch().done(function(model) {
  console.log(a);
});
```
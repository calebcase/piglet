/* Copyright 2013 Caleb Case
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var connect = require('connect');
var express = require('express');
var resourceful = require('resourceful');
var timespec = require('timespec');

var MemoryStore = connect.session.MemoryStore;

function date(str) {
  var at = NaN;
  var perr = null;

  /* Try a timespec. */
  try {
    at = timespec.parse(str);
  }
  catch(exc) {
    perr = exc;
  }

  /* Try converting to an integer. */
  if (isNaN(at)) {
    at = new Date(parseInt(str));
  }

  /* Try the native date parser. */
  if (isNaN(at)) {
    at = new Date(str);
  }

  /* We've done our best... report failure. */
  if (isNaN(at)) {
    throw {'input': str, 'errors': {'timespec': perr, 'as integer': 'NaN', 'as string': 'NaN'}};
  }

  return at;
}

var app = express();
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({
  'secret': 'foo',
  'store': new MemoryStore({
    'reapInterval': 60000 * 60
  })
}));

/* Data Types */
resourceful.use('couchdb', {
  'database': 'piglet'
});

var ID = resourceful.define('id', function() {
  this.string('type');
  this.string('id');
});

var Type = resourceful.define('type', function() {
  this.string('type');
  this.string('id');
  this.string('parent');
});

var Data = resourceful.define('data', function() {
  this.string('type');
  this.string('id');
  this.string('parent');
  this.number('date');
  this.number('value');
});

/* LOGIN */

app.get('/login', function(req, res) {
  res.type('application/json');
  res.send(JSON.stringify({}, null, 2));
});

app.post('/login', function(req, res) {
  res.type('application/json');
  res.send(JSON.stringify({}, null, 2));
});

app.delete('/login', function(req, res) {
  res.type('application/json');
  res.send(JSON.stringify({}, null, 2));
});

/* SETTINGS */

app.get('/settings', function(req, res) {
  res.type('application/json');
  res.send(JSON.stringify({}, null, 2));
});

app.post('/settings', function(req, res) {
  res.type('application/json');
  res.send(JSON.stringify({}, null, 2));
});

/* SERIES */

//app.get('/series', function(req, res) {
//  res.send(JSON.stringify({}, null, 2));
//});

app.get('/series/:id', function(req, res) {
  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    res.type('application/json');
    data = {'series': {}};
    data.series[req.params.id] = null;
    res.send(JSON.stringify(data, null, 2));
  });
});

app.post('/series/:id', function(req, res) {
  ID.create({
    'type': 'id',
    'id': req.params.id
  }, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    res.type('application/json');
    data = {'series': {}};
    data.series[req.params.id] = null;
    res.send(JSON.stringify(data, null, 2));
  });
});

app.get('/series/:id/:type', function(req, res) {
  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    Type.get([req.params.id, req.params.type].join('/'), function(err, result) {
      if (err !== null) {
        res.type('application/json');
        res.send(400, JSON.stringify(err, null, 2));
        return;
      }

      Data.find({
        'type': 'data',
        'parent': [req.params.id, req.params.type].join('/')
      }, function(err, result) {
        if (err !== null) {
          res.type('application/json');
          res.send(400, JSON.stringify(err, null, 2));
          return;
        }

        var found = {};
        for (var i = 0; i < result.length; i++) {
          var data = result[i];
          found[data.date] = data.value;
        }

        res.type('application/json');
        data = {'series': {}};
        data.series[req.params.id] = {};
        data.series[req.params.id][req.params.type] = found;
        res.send(JSON.stringify(found, null, 2));
      });
    });
  });
});

app.post('/series/:id/:type', function(req, res) {
  if (typeof(req.body.data) === 'undefined') {
    res.type('application/json');
    res.send(400, JSON.stringify({'message': 'Request body could not be parsed. Headers set?'}, null, 2));
    return;
  }

  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    Type.create({
      'type': 'type',
      'id': [req.params.id, req.params.type].join('/'),
      'parent': req.params.id
    }, function(err, result) {
      if (err !== null && err['error'] !== 'conflict') {
        res.type('application/json');
        res.send(400, JSON.stringify(err, null, 2));
        return;
      }

      var now = new Date();
      Data.create({
        'type': 'data',
        'id': [req.params.id, req.params.type, now.getTime()].join('/'),
        'parent': [req.params.id, req.params.type].join('/'),
        'date': now.getTime(),
        'value': req.body.data
      }, function(err, result) {
        if (err !== null) {
          res.type('application/json');
          res.send(400, JSON.stringify(err, null, 2));
          return;
        }

        res.type('application/json');
        data = {'series': {}};
        data.series[req.params.id] = {};
        data.series[req.params.id][req.params.type] = {};
        data.series[req.params.id][req.params.type][result.date] = result.value;
        res.send(JSON.stringify(data, null, 2));
      });
    });
  });
});

app.get('/series/:id/:type/:start', function(req, res) {
  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    Type.get([req.params.id, req.params.type].join('/'), function(err, result) {
      if (err !== null) {
        res.type('application/json');
        res.send(400, JSON.stringify(err, null, 2));
        return;
      }

      Data.find({
        'type': 'data',
        'parent': [req.params.id, req.params.type].join('/')
      }, function(err, result) {
        if (err !== null) {
          res.type('application/json');
          res.send(400, JSON.stringify(err, null, 2));
          return;
        }

        try {
          var since = date(req.params.start);
        }
        catch(exc) {
          res.type('application/json');
          res.send(400, JSON.stringify(exc, null, 2));
          return;
        }

        var found = {};
        for (var i = 0; i < result.length; i++) {
          var data = result[i];
          if (data.date >= since.getTime()) {
            found[data.date] = data.value;
          }
        }

        res.type('application/json');
        data = {'series': {}};
        data.series[req.params.id] = {};
        data.series[req.params.id][req.params.type] = found;
        res.send(JSON.stringify(data, null, 2));
      });
    });
  });
});

app.post('/series/:id/:type/:start', function(req, res) {
  if (typeof(req.body.data) === 'undefined') {
    res.type('application/json');
    res.send(400, JSON.stringify({'message': 'Request body could not be parsed. Headers set?'}, null, 2));
    return;
  }

  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    Type.get([req.params.id, req.params.type].join('/'), function(err, result) {
      if (err !== null) {
        res.type('application/json');
        res.send(400, JSON.stringify(err, null, 2));
        return;
      }


      try {
        var at = date(req.params.start);
      }
      catch(exc) {
        res.type('application/json');
        res.send(400, JSON.stringify(exc, null, 2));
        return;
      }

      Data.create({
        'type': 'data',
        'id': [req.params.id, req.params.type, at.getTime()].join('/'),
        'parent': [req.params.id, req.params.type].join('/'),
        'date': at.getTime(),
        'value': req.body.data
      }, function(err, result) {
        if (err !== null) {
          res.type('application/json');
          res.send(400, JSON.stringify(err, null, 2));
          return;
        }

        res.type('application/json');
        data = {'series': {}};
        data.series[req.params.id] = {};
        data.series[req.params.id][req.params.type] = {};
        data.series[req.params.id][req.params.type][result.date] = result.value;
        res.send(JSON.stringify(data, null, 2));
      });
    });
  });
});

app.get('/series/:id/:type/:start/:stop', function(req, res) {
  ID.get(req.params.id, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    Type.get([req.params.id, req.params.type].join('/'), function(err, result) {
      if (err !== null) {
        res.type('application/json');
        res.send(400, JSON.stringify(err, null, 2));
        return;
      }

      Data.find({
        'type': 'data',
        'parent': [req.params.id, req.params.type].join('/')
      }, function(err, result) {
        if (err !== null) {
          res.type('application/json');
          res.send(400, JSON.stringify(err, null, 2));
          return;
        }

        try {
          var since = date(req.params.start);
          var until = date(req.params.stop);
        }
        catch(exc) {
          res.type('application/json');
          res.send(400, JSON.stringify(exc, null, 2));
          return;
        }

        var found = {};
        for (var i = 0; i < result.length; i++) {
          var data = result[i];
          if (data.date >= since.getTime() &&
              data.date <= until.getTime()) {
            found[data.date] = data.value;
          }
        }

        res.type('application/json');
        data = {'series': {}};
        data.series[req.params.id] = {};
        data.series[req.params.id][req.params.type] = found;
        res.send(JSON.stringify(data, null, 2));
      });
    });
  });
});

console.log('Listening on 3030.');
app.listen(3030);

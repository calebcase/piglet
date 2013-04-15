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

var async = require('async');
var connect = require('connect');
var express = require('express');
var minimatch = require('minimatch');
var mongoose = require('mongoose');
var timespec = require('timespec');

var MemoryStore = connect.session.MemoryStore;

var minimatch_options = {
  'noglobstar': true,
  'dot': true,
  'noext': true,
  'nocomment': true
};

function date_like(str) {
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

mongoose.connect('localhost', 'piglet');

var Schema = mongoose.Schema;

var idSchema = new Schema({
  '_id': { 'type': String },
}, {
  'collection': 'id'
});

var ID = mongoose.model('ID', idSchema);

var typeSchema = new Schema({
  '_id': { 'type': String },
}, {
  'collection': 'type'
});

var Type = mongoose.model('Type', typeSchema);

var dataSchema = new Schema({
  '_id': { 'type': String },
  'date': { 'type': Date },
  'value': { 'type': Number },
}, {
  'collection': 'data'
});

var Data = mongoose.model('Data', dataSchema);

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

app.get('/series', function(req, res) {
  ID.find(function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    var data = { 'series': {} };
    for (var i = 0; i < result.length; i++) {
      data.series[result[i]._id] = null;
    }

    res.type('application/json');
    res.send(JSON.stringify(data, null, 2));
  });
});

app.put(/\/series(?:\/([^\/]+)(?:\/([^\/]+)(?:\/([^\/]+)(?:\/([^\/]+))?)?)?)?/, function(req, res) {
  req.params.id = req.params[0];
  req.params.type = req.params[1];

  req.params.start = req.params[2];
  req.params.stop = req.params[3];

  var body = req.body;
  if (!('series' in body)) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Request body could doesn\'t contain a \'series\'.'}, null, 2));
    return;
  }

  var series = body.series;

  var id_matcher = null;
  if (req.params.id) {
    id_matcher = new minimatch.Minimatch(req.params.id, minimatch_options).makeRe();
    if (!id_matcher) {
      res.type('application/json');
      res.send(400, JSON.stringify({ 'message': 'Invalid id glob specified.' }, null, 2));
      return;
    }
  }

  var type_matcher = null;
  if (req.params.type) {
    type_matcher = new minimatch.Minimatch(req.params.type, minimatch_options).makeRe();
    if (!type_matcher) {
      res.type('application/json');
      res.send(400, JSON.stringify({ 'message': 'Invalid type glob specified.' }, null, 2));
      return;
    }
  }

  var start = null;
  if (req.params.start) {
    try {
      start = date_like(req.params.start).getTime();
    }
    catch(exc) {
      res.type('application/json');
      res.send(400, JSON.stringify({ 'message': 'Invalid start time specified.', 'error': exc }, null, 2));
      return;
    }
  }

  var stop = null;
  if (req.params.stop) {
    try {
      stop = date_like(req.params.stop).getTime();
    }
    catch(exc) {
      res.type('application/json');
      res.send(400, JSON.stringify({ 'message': 'Invalid stop time specified.', 'error': exc }, null, 2));
      return;
    }
  }

  var tasks = [];

  /* Remove the related documents. */
  if (!start) {
    var data_glob = '';
    data_glob += req.params.id ? req.params.id : '*';
    data_glob += req.params.type ? '/' + req.params.type : '/*';
    data_glob += '/*';
    var search = new minimatch.Minimatch(data_glob, minimatch_options).makeRe();
    tasks.push(function(cb) {
      Data.find({ '_id': search}).remove(function(err, result) {
        cb(null, err);
      });
    });
  }
  else {
    var path = [req.params.id, req.params.type].join('/');
    if (!stop) {
      tasks.push(function(cb) {
        var search = new minimatch.Minimatch(path + '/*', minimatch_options).makeRe();
        Data.find({ '_id': search})
        .where('date')
        .gte(start)
        .remove(function(err, result) {
          cb(null, err);
        });
      });
    }
    else {
      tasks.push(function(cb) {
        var search = new minimatch.Minimatch(path + '/*', minimatch_options).makeRe();
        Data.find({ '_id': search})
        .where('date')
        .gte(start)
        .lte(stop)
        .remove(function(err, result) {
          cb(null, err);
        });
      });
    }
  }

  /* Put the supplied document in. */
  for (var id in series) {
    if (id_matcher === null || id_matcher.exec(id)) {
      for (var type in series[id]) {
        if (type_matcher === null || type_matcher.exec(type)) {
          for (var date in series[id][type]) {
            var date_int = parseInt(date);
            if (start === null ||
                ((stop === null && date_int >= start) ||
                 (date_int >= start && date_int <= stop))) {
              (function(id, type, date) {
                tasks.push(function(cb) {
                  var instance = new Data();
                  instance._id = [id, type, date].join('/');
                  instance.date = new Date(parseInt(date));
                  instance.value = series[id][type][date];
                  instance.save(function(err) {
                    if (err) err.path = ['series', id, type, date].join('/');
                    cb(null, err);
                  });
                });
              })(id, type, date);
            }
          }
        }
      }
    }
  }

  async.series(tasks, function(err, result) {
    var errors = result.filter(function(item) {
      return item !== null;
    });

    var code = 200;
    if (errors.length !== 0) {
      code = 400;
    }

    res.type('application/json');
    res.send(code, JSON.stringify(errors, null, 2));
  });
});

app.get('/series/:id', function(req, res) {
  var search = new minimatch.Minimatch(req.params.id + '/*', minimatch_options).makeRe();
  if (!search) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
  }

  Type.find({ '_id': search }, function(err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    var data = { 'series': {} };
    for (var i = 0; i < result.length; i++) {
      var segments = result[i]._id.split('/');
      var id = segments[0];
      var type = segments[1];
      if (!(id in data.series)) {
        data.series[id] = {};
      }

      data.series[id][type] = null;
    }

    res.type('application/json');
    res.send(JSON.stringify(data, null, 2));
  });
});

app.delete('/series/:id', function(req, res) {
  var search = new minimatch.Minimatch(req.params.id + '/*/*', minimatch_options).makeRe();
  if (!search) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
  }

  Data.find({ '_id': search }).remove(function(err, result) {
    var search = new minimatch.Minimatch(req.params.id + '/*', minimatch_options).makeRe();
    if (!search) {
      res.type('application/json');
      res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
    }

    res.type('application/json');
    res.send(JSON.stringify({ 'status': 'ok' }, null, 2));
  });
});

app.get(/\/series\/(([^\/]+)\/([^\/]+))(?:\/([^\/]+)(?:\/([^\/]+))?)?/, function(req, res) {
  req.params.path = req.params[0];
  req.params.id = req.params[1];
  req.params.type = req.params[2];

  req.params.start = req.params[3];
  req.params.stop = req.params[4];

  var search = new minimatch.Minimatch(req.params.path + '/*', minimatch_options).makeRe();
  if (!search) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
  }

  var cb = function (err, result) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    var data = { 'series': {} };

    for (var i = 0; i < result.length; i++) {
      var segments = result[i]._id.split('/');
      var id = segments[0];
      var type = segments[1];
      var date = segments[2];

      if (!(id in data.series)) {
        data.series[id] = {};
      }

      if (!(type in data.series[id])) {
        data.series[id][type] = {};
      }

      data.series[id][type][date] = result[i].value;
    }

    res.type('application/json');
    res.send(JSON.stringify(data, null, 2));
  };

  if (!req.params.start && !req.params.stop) {
    Data.find({
      '_id': search
    }, cb);
  }
  else if (req.params.start && !req.params.stop) {
    var start = date_like(req.params.start);

    Data.find({
      '_id': search
    })
    .where('date')
    .gte(start)
    .exec(cb);
  }
  else if (req.params.start && req.params.stop) {
    var start = date_like(req.params.start);
    var stop = date_like(req.params.stop);

    Data.find({
      '_id': search
    })
    .where('date')
    .gte(start)
    .lte(stop)
    .exec(cb);
  }
  else {
    /* Should never happen... */
    res.type('application/json');
    res.send(500, JSON.stringify({ 'message': 'Aww... Now we\'ll never have bacon.' }, null, 2));
  }
});

app.post(/\/series\/(([^\/]+)\/([^\/]+))(?:\/([^\/]+))?/, function(req, res) {
  req.params.path = req.params[0];
  req.params.id = req.params[1];
  req.params.type = req.params[2];

  req.params.start = req.params[3];

  if (typeof(req.body.value) === 'undefined') {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Request body could not be parsed. Headers set?'}, null, 2));
    return;
  }

  var now = new Date();
  if (req.params.start) {
    now = date_like(req.params.start);
  }

  var instance = new Data();
  instance._id = [req.params.path, now.getTime()].join('/');
  instance.date = now;
  instance.value = req.body.value;
  instance.save(function(err) {
    if (err !== null) {
      res.type('application/json');
      res.send(400, JSON.stringify(err, null, 2));
      return;
    }

    data = { 'series': {} };
    data.series[req.params.id] = {};
    data.series[req.params.id][req.params.type] = {};
    data.series[req.params.id][req.params.type][now.getTime()] = req.body.value;

    res.type('application/json');
    res.send(JSON.stringify(data, null, 2));
  });
});

app.delete(/\/series\/(([^\/]+)\/([^\/]+))/, function(req, res) {
  req.params.path = req.params[0];
  req.params.id = req.params[1];
  req.params.type = req.params[2];

  var search = new minimatch.Minimatch(req.params.path, minimatch_options).makeRe();
  if (!search) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
  }

  res.type('application/json');
  res.send(JSON.stringify({ 'status': 'ok' }, null, 2));
});

app.delete(/\/series\/(([^\/]+)\/([^\/]+))\/(?:([^\/]+)(?:\/([^\/]+))?)?/, function(req, res) {
  req.params.path = req.params[0];
  req.params.id = req.params[1];
  req.params.type = req.params[2];

  req.params.start = req.params[3];
  req.params.stop = req.params[4];

  var search = new minimatch.Minimatch(req.params.path + '/*', minimatch_options).makeRe();
  if (!search) {
    res.type('application/json');
    res.send(400, JSON.stringify({ 'message': 'Invalid glob specified.' }, null, 2));
  }

  if (!req.params.start && !req.params.stop) {
    Data.find({
      '_id': search
    })
    .remove();
  }
  else if (req.params.start && !req.params.stop) {
    var start = date_like(req.params.start);

    Data.find({
      '_id': search
    })
    .where('date')
    .gte(start)
    .remove();
  }
  else if (req.params.start && req.params.stop) {
    var start = date_like(req.params.start);
    var stop = date_like(req.params.stop);

    Data.find({
      '_id': search
    })
    .where('date')
    .gte(start)
    .lte(stop)
    .remove();
  }
  else {
    /* Should never happen... */
    res.type('application/json');
    res.send(500, JSON.stringify({ 'message': 'Aww... Now we\'ll never have bacon.' }, null, 2));
  }

  res.type('application/json');
  res.send(JSON.stringify({ 'status': 'ok' }, null, 2));
});

console.log('Listening on 3030.');
app.listen(3030);

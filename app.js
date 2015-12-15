/*
 * Copyright 2014, 2015 High Performance Computing Center, Stuttgart
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

var basicAuth = require('basic-auth-connect');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var path = require('path');

/*
 * setup of Elasticsearch
 */
var elasticsearch = require('elasticsearch');
var elastic = new elasticsearch.Client({
  host: 'localhost:9200', /* host and port of a running Elasticsearch node */
  log: 'trace'
});

/*
 * authentication for blocked excess pages
 */
var auth = basicAuth(function(user, pass, callback) {
  var result = (user === 'excess' && pass === 'developer');
  callback(null /* error */, result);
});

/*
 * routing
 */
var about = require('./routes/about');
var contact = require('./routes/contact');
var developer = require('./routes/api');
var excess = require('./routes/excess');
var infoviz = require('./routes/infoviz');
var mf = require('./routes/mf');
var routes = require('./routes/index');

/*
 * view engine setup
 */
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('elastic', elastic);

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/infoviz', infoviz);
app.use('/mf', mf);
app.use('/api', developer);
app.use('/excess', auth, excess);
app.use('/about', about);
app.use('/contact', contact);

/*
 * catch 404 and forward to error handler
 */
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/*
 * error handlers
 */
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {} /* no stacktrace */
  });
});

module.exports = app;
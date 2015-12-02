var express = require('express');
var basicAuth = require('basic-auth-connect');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var elasticsearch = require('elasticsearch');
var elastic = new elasticsearch.Client({
  host: '192.168.0.160:9200',
  log: 'trace'
});

var routes = require('./routes/index');
var mf = require('./routes/mf');
var infoviz = require('./routes/infoviz');
var developer = require('./routes/api');
var excess = require('./routes/excess');
var about = require('./routes/about');
var contact = require('./routes/contact');

var app = express();

// Asynchronous
var auth = basicAuth(function(user, pass, callback) {
  var result = (user === 'excess' && pass === 'developer');
  callback(null /* error */, result);
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('elastic', elastic);

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;

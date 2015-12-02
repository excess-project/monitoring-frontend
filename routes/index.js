var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get('/count/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    client.count({
        index: req.params.ID.toLowerCase()
    }, function (error, response) {
        if (error) {
            res.send('1000');
        } else if (response) {
            res.send(response.count.toString());
        } else {
            res.send('1000');
        }
    });
});

router.get('/executions', function(req, res, next) {
    var client = req.app.get('elastic'),
	size = req.query.size;
    if (!size) {
      size = 10000;
    }

    client.search({
        index: 'executions',
        size: size,
        sort: '_id:desc',
    }, function(err, result) {
        if (err) {
            res.status(500);
            return next(err);
        }
        else {
            if (result.hits != undefined){
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);

                keys.forEach(function(key){
                 var message = {};
                 message.id = only_results[key]._id;
                 message.Name = only_results[key]._source.Name;
                 message.Description = only_results[key]._source.Description;
                 message.Start_date = only_results[key]._source.Start_date;
                 message.Username = only_results[key]._source.Username;
                 es_result.push(message);
                });
                res.send(es_result);
            } else {
                res.send('No data in the DB');
            }
        }
    })
});

var skip_fields = [ 'Timestamp', 'type', 'hostname' ];
router.get('/executions/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;
    var result_size = 1000;
    if (req.query.size) {
        result_size = req.query.size;
    }

    client.search({
        index:req.params.ID.toLowerCase(),
        size: result_size,
        sort:["type", "Timestamp"],
    },function(err, result){
        if (err){
            console.log('Error searching for the values of a specific benchmark: '+err);
            res.send(err);
        }
        else {
            if (result.hits != undefined){
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);
                var power_result = {};

                keys.forEach(function(key) {
                    var data = only_results[key]._source;
                    if (data.type != "power") {
                        es_result.push(data);
                        return;
                    }
                    var processed = false;
                    for (var key in data) {
                        if (processed)
                            return;
                        if (data.hasOwnProperty(key)) {
                            if (skip_fields.indexOf(key) > -1 || key == '')
                                continue;
                            var value = parseInt(data[key]);
                            var time = data['Timestamp']; // 1430646029.762737460
			    time = time.toString();
                            time = time.substring(0, 13); // 1430646029.76
                            var metrics = power_result[time];
                            if (!metrics) {
                                metrics = {};
                                metrics.Timestamp = time;
                                metrics.type = data.type;
                            }
                            metrics[key] = value;
                            power_result[time] = metrics;
                            processed = true;
                        }
                    }
                    //es_result.push(data);
                });
                for (var key in power_result) {
                    es_result.push(power_result[key]);
                }
                res.json(es_result);
            } else {
                res.send('No data in the DB');
            }
        }
    })
});

router.get('/ping', function(req, res, next) {
    var client = req.app.get('elastic');
    client.info("",function(err,resp){
        if (err){
            console.log(err);
            res.send('No connection to ElasticSearch Cluster');
        } else {
            console.log(resp);
            res.send(resp);
        }
    });
});

router.get('/executions/:ID/time', function(req, res, next) {
    var client = req.app.get('elastic');

    client.search({
        index:req.params.ID.toLowerCase(),
        size: 1,
        sort: [ "Timestamp:asc" ],
    }, function(err, result) {
        var start;
        var end;

        if (err) {
            console.log('Error searching for the values of a specific benchmark: '+err);
        } else {
            if (result.hits != undefined){
                var only_results = result.hits.hits;
                var keys = Object.keys(only_results);
                keys.forEach(function(key){
                    var metric_data = only_results[key]._source;
                    start = metric_data.Timestamp;
                });
            }
        }

        client.search({
            index:req.params.ID.toLowerCase(),
            size: 1,
            sort: [ "Timestamp:desc" ],
        }, function(err, result) {
            var response;
            if (err) {
                console.log('Error searching for the values of a specific benchmark: '+err);
            } else {
                if (result.hits != undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);
                    keys.forEach(function(key){
                        var metric_data = only_results[key]._source;
                        end = metric_data.Timestamp;
                    });
                }
            }

            var response = '{ "start": ' + start + ', "end": ' + end + ', "duration": ' + (end-start) + ' }';
            res.send(response);
        });
    });
});

router.get('/executions/details/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    client.get({
        index:'executions',
        type: 'TBD',
        id: req.params.ID
    }, function(err, result) {
        if (result.found != false){
            res.send(result._source);
        } else {
            res.send('Requested resource was Not found');
        }
    });
});

router.get('/executions/details/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var id = req.params.ID.toLowerCase();
    client.indices.getMapping({
            index:req.params.ID.toLowerCase(),
        },
        function(err, result){
        if (err){
            console.log('Error searching metrics of a specific execution: '+err);
            res.send(err);
        }
        else{
            var metrics = result[id].mappings.TBD.properties;
            var names = [];
            var metric_name = Object.keys(metrics);
            metric_name.forEach(function(metric){
                if (metric != "Timestamp" && metric != "type"){
                    names.push(metric);
                }
            });
            res.send(names);
        }
    })
});

router.get('/executions/metrics/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var id = req.params.ID.toLowerCase();
    client.indices.getMapping({
        index:req.params.ID.toLowerCase(),
    }, function(err, result) {
        if (err){
            console.log('Error searching metrics of a specific execution: '+err);
            res.send(err);
        }
        else{
            var metrics = result[id].mappings.TBD.properties;
            var names = [];
            var metric_name = Object.keys(metrics);
            metric_name.forEach(function(metric){
                if (metric != "Timestamp" && metric != "type"){
                    names.push(metric);
                }
            });
            res.send(names);
        }
    })
});

router.get('/execution/stats/:ID/:metric/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var metric_name = req.params.metric;
    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index: req.params.ID.toLowerCase(),
        size: 0,
        body: {
            aggs:{
                range_metric : {
                    filter: {range: {"Timestamp" : { "from" : from_time, "to" : to_time }}},
                    aggs: {"extended_stats_metric" : { extended_stats : { "field" : metric_name }}}
                }
            }
        }
    }, function(err, result){
        if (err) {
            res.status(500);
            return next(err);
        }
        else {
            if (result.hits != undefined){
                var only_results = result.aggregations.range_metric.extended_stats_metric;
                res.send(only_results);
            } else {
                res.send('No data in the DB');
            }
        }
    })
});

router.get('/executions/:ID/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index:req.params.ID.toLowerCase(),
        body: {
            query: {
                constant_score: {
                    filter: {
                        range: {
                        "Timestamp" : { "from" : from_time, "to" : to_time }
                      }
                    }
                }
            }
        }
    }, function(err, result) {
        if(err) {
            res.status(500);
            return next(err);
        }
        else {
            if (result.hits != undefined){
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);
                keys.forEach(function(key) {
                    es_result.push(only_results[key]._source);
                });
                res.send(es_result);
            } else {
                res.send('No data in the DB');
            }
        }
    });
});

router.post('/executions', function(req, res, next) {
    var client = req.app.get('elastic');

    var the_json = req.body;
    var exit = false;
    (function loopStartWith() {
        if (exit === false) {
            client.index({index:'executions',type: 'TBD', body:the_json},function(err,es_reply){
                if (!err) {
                    if ( (/^_/).test(es_reply._id) ) {
                        client.delete({index: 'executions',type: 'TBD',id: es_reply._id}, function (error, response) {
                            if (!error) {
                                console.log("Deleted Execution id started with underscore: "+es_reply._id);
                            }
                            else {
                                console.log("Error deleting id started with underscore : "+error);
                            }
                        });
                        exit = false;
                    }
                    else{
                        exit = true;
                        res.send(es_reply._id);
                    }
                }
            loopStartWith();
            });
        }
    }());
});

router.post('/executions/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var the_json = req.body;
    client.index({index:req.params.ID.toLowerCase(),type: 'TBD',body:the_json},function(err,es_reply){
        res.send(es_reply);
    });
});

module.exports = router;

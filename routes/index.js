/*
 * Copyright (C) 2014-2015 University of Stuttgart
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

var express = require('express');
var router = express.Router();

/** @brief Shows front-page
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return static front-page of the monitoring server
 */
router.get('/', function(req, res, next) {
    res.render('index');
});

/** @brief Returns the available metrics for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return an integer value
 */
router.get('/count/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    client.count({
        index: req.params.ID.toLowerCase()
    }, function(error, response) {
        if (error) {
            res.send('1000');
        } else if (response) {
            res.send(response.count.toString());
        } else {
            res.send('1000');
        }
    });
});

/** @brief Returns details on all registered experiments
 *
 * This GET request is used to fill the experiments table on the front-page.
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return a JSON document containing experiment details
 */
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
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);

                /*
                 * response format:
                 * {
                 *   "Name": ...,
                 *   "Description": ...,
                 *   "Start_date": ...,
                 *   "Username": ...
                 * }
                 */
                keys.forEach(function(key) {
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

/*
 * variable used by /visualization
 */
var skip_fields = ['Timestamp', 'type', 'hostname'];

/** @brief Returns the actual sampled data for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return a JSON array with metric data
 */
router.get('/executions/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;
    var result_size = 1000;
    if (req.query.size) {
        result_size = req.query.size;
    }

    client.search({
        index: req.params.ID.toLowerCase(),
        size: result_size,
        sort: ["type", "Timestamp"],
    }, function(err, result) {
        if (err) {
            console.log('Error searching for the values of a specific benchmark: ' + err);
            res.send(err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);
                var power_result = {};

                keys.forEach(function(key) {
                    var data = only_results[key]._source;
                    /*
                     * if metric is from external power measurement system, then
                     * we have to do some more pre-processing. otherwise, we
                     * just add the metric data to our response
                     */
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
                            /*
                             * parse and simplify time-stamp
                             * step is required to be compatible with Rickshaw
                             */
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
                });
                /*
                 * now, add the updated power metrics
                 */
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

/** @brief GET request to check if the server is available
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return database information on success; error message otherwise
 */
router.get('/ping', function(req, res, next) {
    var client = req.app.get('elastic');
    client.info("", function(err, resp) {
        if (err) {
            console.log(err);
            res.send('No connection to ElasticSearch Cluster');
        } else {
            console.log(resp);
            res.send(resp);
        }
    });
});

/** @brief Returns the runtime for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return runtime information of a given experiment
 */
router.get('/executions/:ID/time', function(req, res, next) {
    var client = req.app.get('elastic');

    /*
     * get the earliest time-stamp by sorting in ascending order
     */
    client.search({
        index: req.params.ID.toLowerCase(),
        size: 1,
        sort: ["Timestamp:asc"],
    }, function(err, result) {
        var start;
        var end;

        if (err) {
            console.log('Error searching for the values of a specific benchmark: ' + err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var keys = Object.keys(only_results);
                keys.forEach(function(key) {
                    var metric_data = only_results[key]._source;
                    start = metric_data.Timestamp;
                });
            }
        }

        /*
         * get the latest time-stamp by sorting in descending order
         */
        client.search({
            index: req.params.ID.toLowerCase(),
            size: 1,
            sort: ["Timestamp:desc"],
        }, function(err, result) {
            var response;
            if (err) {
                console.log('Error searching for the values of a specific benchmark: ' + err);
            } else {
                if (result.hits != undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);
                    keys.forEach(function(key) {
                        var metric_data = only_results[key]._source;
                        end = metric_data.Timestamp;
                    });
                }
            }

            /*
             * create response object
             */
            var response = '{ "start": ' + start + ', "end": ' + end + ', "duration": ' + (end - start) + ' }';
            res.send(response);
        });
    });
});

/** @brief Return details for a given experiment
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return details about an experiment as shown on the front-page
 */
router.get('/executions/details/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    client.get({
        index: 'executions',
        type: 'TBD',
        id: req.params.ID
    }, function(err, result) {
        if (result.found != false) {
            res.send(result._source);
        } else {
            res.send('Requested resource was Not found');
        }
    });
});

/** @brief Return all available metrics sampled for a given experiment
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return list of sampled metrics
 */
router.get('/executions/metrics/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var id = req.params.ID.toLowerCase();
    client.indices.getMapping({
            index: req.params.ID.toLowerCase(),
        },
        function(err, result) {
            if (err) {
                console.log('Error searching metrics of a specific execution: ' + err);
                res.send(err);
            } else {
                var metrics = result[id].mappings.TBD.properties;
                var names = [];
                var metric_name = Object.keys(metrics);
                metric_name.forEach(function(metric) {
                    if (metric != "Timestamp" && metric != "type") {
                        names.push(metric);
                    }
                });
                res.send(names);
            }
        })
});

/** @brief Returns basic statistics for a given experiment, metric, and time interval
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return JSON document having statistics such as standard deviation
 */
router.get('/execution/stats/:ID/:metric/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var metric_name = req.params.metric;
    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index: req.params.ID.toLowerCase(),
        size: 0,
        body: {
            aggs: {
                range_metric: {
                    filter: {
                        range: {
                            "Timestamp": {
                                "from": from_time,
                                "to": to_time
                            }
                        }
                    },
                    aggs: {
                        "extended_stats_metric": {
                            extended_stats: {
                                "field": metric_name
                            }
                        }
                    }
                }
            }
        }
    }, function(err, result) {
        if (err) {
            res.status(500);
            return next(err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.aggregations.range_metric.extended_stats_metric;
                res.send(only_results);
            } else {
                res.send('No data in the DB');
            }
        }
    })
});

/** @brief Filters sampled data based on given time interval
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return same as /executions/:ID
 */
router.get('/executions/:ID/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index: req.params.ID.toLowerCase(),
        body: {
            query: {
                constant_score: {
                    filter: {
                        range: {
                            "Timestamp": {
                                "from": from_time,
                                "to": to_time
                            }
                        }
                    }
                }
            }
        }
    }, function(err, result) {
        if (err) {
            res.status(500);
            return next(err);
        } else {
            if (result.hits != undefined) {
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

/** @brief Register a new experiment
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return a unique experiment ID generated by the database
 */
router.post('/executions', function(req, res, next) {
    var client = req.app.get('elastic');

    var the_json = req.body;
    var exit = false;
    (function loopStartWith() {
        if (exit === false) {
            client.index({
                index: 'executions',
                type: 'TBD',
                body: the_json
            }, function(err, es_reply) {
                if (!err) {
                    if ((/^_/).test(es_reply._id)) {
                        client.delete({
                            index: 'executions',
                            type: 'TBD',
                            id: es_reply._id
                        }, function(error, response) {
                            if (!error) {
                                console.log("Deleted Execution id started with underscore: " + es_reply._id);
                            } else {
                                console.log("Error deleting id started with underscore : " + error);
                            }
                        });
                        exit = false;
                    } else {
                        exit = true;
                        res.send(es_reply._id);
                    }
                }
                loopStartWith();
            });
        }
    }());
});

/** @brief Adds a new experiment having its own experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return response generated by Elasticsearch
 */
router.post('/executions/add/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var the_json = req.body;
    client.index({
        index: 'executions',
        type: 'TBD',
        id: req.params.ID.toLowerCase(),
        body: the_json
    }, function(err, es_reply) {
        res.send(es_reply);
    });
});

/** @brief Adds new metric data for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return response generated by Elasticsearch
 */
router.post('/executions/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var the_json = req.body;
    client.index({
        index: req.params.ID.toLowerCase(),
        type: 'TBD',
        body: the_json
    }, function(err, es_reply) {
        res.send(es_reply);
    });
});

module.exports = router;

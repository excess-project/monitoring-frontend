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
var async = require('async');
var request = require('request');
var moment = require('moment');
var router = express.Router();

/* visualization of excess experiments */
router.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/visualization.html');
});

/* visualization of dreamcloud experiments */
router.get('/dreamcloud', function(req, res, next) {
    res.sendFile(__dirname + '/dreamcloud_vi.html');
});

/*
 * variable used by /visualization
 */
var skip_metrics = ['@timestamp', 'type', 'host', 'task', 'platform' ];

/** @brief Get the start and end time for each task with given workflowID and experimentID
 *
 * This GET request is used by dreamcloud visualization to add annotators in Rickshaw graph
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return an array of tasks' annotators
 */
router.get('/annotators/:workflowID/:experimentID', function (req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      workflow = req.params.workflowID.toLowerCase(),
      experiment = req.params.experimentID,
      dreamcloud_pwm_idx = 'power_dreamcloud';

    var annotators = [];

    client.get({
        index: 'mf',
        type: 'workflows',
        id: workflow
    }, function (error, result) {
        if (error) {
            var message = {};
            message.error = 'Given workflow ID does not exist.';
            res.status(404);
            return next(message);
        }
        if (result !== undefined) {
            
            var tasks = result._source.tasks;

            /* FOR EACH TASK */
            async.each(tasks, function(task, callback) {
                task = task.name;
                var resource = workflow + "_" + task;
                resource = resource.toLowerCase();
                var start=0, 
                    end = 0, 
                    message = '';
                async.series([
                    /* GET START DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:asc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results);
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    start = moment(metric_data['@timestamp']).unix();

                                });
                                series_callback(null);
                            }
                        });
                    },
                    /* GET END DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:desc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results);
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    end = moment(metric_data['@timestamp']).unix();
                                });
                                series_callback(null);
                            }
                        });
                    },
                    /* push the start and end time to annotators*/
                    function(series_callback) {
                        if((start !== 0) && (end !== 0)) {
                            annotators.push({
                                start: start,
                                end: end,
                                message: task
                            });
                        }
                        series_callback(null);
                    }
                ], function(error) {
                    if (error) {
                        return callback();
                    }
                    callback(null);
                });
            }, function(error) {
                if (error) {
                    res.status(500);
                    return next(error);
                }
                res.send(annotators);
            });
        }
    });
});

/** @brief Transforms available data for excess visualization
 *
 * This GET request process the metric data to be compatible with the
 * Rickshaw library, which is used for visualizing the data on the front end.
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return cleaned data used as direct input to generate a graph with Rickshaw
 */
router.get('/:workflow/:task/:experiment', function(req, res, next) {
    var client = req.app.get('elastic'),
        units = req.app.get('units'),
        workflow = req.params.workflow.toLowerCase(),
        task = req.params.task.toLowerCase(),
        experiment = req.params.experiment,
        metrics = req.query.metrics,
        live = req.query.live,
        host = req.query.hostname;

    var index = workflow + '_' + task;

    /*
     * first, determine the number of available database entries
     */
    client.count({
        index: index,
        type: experiment
    }, function(error, response) {
        var count = 2000;
        if (live === undefined) {
            if (response !== undefined) {
                if (response.count >= 10000) {
                    count = 10000;
                } else {
                    count = response.count;
                }
            }
        }

        /*
         * then, sort by timestamp in descending order
         */
        client.search({
            index: index,
            type: experiment,
            size: count,
            sort: [ '@timestamp:desc' ]
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
                var global = [];
                var results = {};
                if (result.hits !== undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);
                    var x_values = [
                        []
                    ];

                    /*
                     * traverse over all results
                     */
                    keys.reverse().forEach(function(key) {
                        var data = only_results[key]._source;
                        var timestamp = moment(data['@timestamp']).unix();
                        var hostname = '';
                        if (data.host !== undefined) {
                            hostname = data.host;
                        }

                        /*
                         * filter entries by hostname
                         */
                        if ((host !== undefined) &&
                            (data.host !== undefined) &&
                            (host !== data.host) &&
                            (host != 'All Hosts')) {
                            return;
                        }

                        // aggregate relevant data
                        for (key in data) {
                            if (data.hasOwnProperty(key)) {
                                /* skip non-metric data */
                                if (skip_metrics.indexOf(key) > -1 || key === '')
                                    continue;
                                /* skip metrics starting with 'info_' */
                                if (key.indexOf('info_') === 0) {
                                    continue;
                                }
                                var metric_name = key;
                                if (metric_name.indexOf(hostname) < 0) {
                                    metric_name = key + '_' + hostname;
                                }
                                if (units[key] !== undefined){
                                    metric_name += '(' + units[key] + ')';
                                }
                                if (!metrics || (metrics && metrics.indexOf(metric_name) > -1)) {
                                    var metric_values = results[key];
                                    if (!metric_values) {
                                        metric_values = [];
                                    }
                                    var name = timestamp;
                                    var value = parseFloat(data[key]);

                                    if (value !== undefined && name !== undefined) {
                                        var keys = x_values[metric_name];
                                        if (!keys) {
                                            x_values[metric_name] = {};
                                        }
                                        var y_values = x_values[metric_name][name];
                                        if (!y_values) {
                                            y_values = [];
                                        }
                                        y_values.push(value);
                                        x_values[metric_name][name] = y_values;
                                    }
                                }
                            }
                        }
                    });

                    /*
                     * validate and modify values
                     */
                    for (var key in x_values) {
                        if (key == '0')
                            continue;
                        results = [];

                        /*
                         * reduce amount of data for visualization
                         */
                        for (var timestamp in x_values[key]) {
                            var values = x_values[key][timestamp];
                            var sum = values.reduce(function(a, b) {
                                return a + b;
                            });
                            var avg = sum / values.length;
                            /*
                             * only keep the average value per second
                             */
                            results.push({
                                x: parseInt(timestamp),
                                y: avg
                            });
                        }
                        global.push({
                            name: key,
                            data: results
                        });
                    }
                    res.send(global);
                } else {
                    res.send('No data in the DB');
                }
            }
        });
    });
});

/** @brief Transforms available data for dreamcloud visualization
 *
 * This GET request process the metric data to be compatible with the
 * Rickshaw library, which is used for visualizing the data on the front end.
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return cleaned data used as direct input to generate a graph with Rickshaw
 */
router.get('/:workflowID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      workflow = req.params.workflowID.toLowerCase(),
      experiment = req.params.experimentID,
      dreamcloud_pwm_idx = 'power_dreamcloud',
      metrics = ['NODE01', 'NODE02', 'NODE03'];

    var global = [];

    client.get({
        index: 'mf',
        type: 'workflows',
        id: workflow
    }, function (error, result) {
        if (error) {
            var message = {};
            message.error = 'Given workflow ID does not exist.';
            res.status(404);
            return next(message);
        }
        if (result !== undefined) {
            var ranges = {};
            var tasks = result._source.tasks;

            /* FOR EACH TASK */
            async.each(tasks, function(task, callback) {
                task = task.name;
                var resource = workflow + "_" + task;
                resource = resource.toLowerCase();
                ranges[task] = {};

                async.series([
                    /* GET START DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:asc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results),
                                    start = 0;
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    start = metric_data['@timestamp'];
                                    start = start.replace(/\s/g, '0');
                                });
                                
                                ranges[task].start = start;
                                series_callback(null);
                            }
                        });
                    },
                    /* GET END DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:desc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results),
                                    end = 0;
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    end = metric_data['@timestamp'];
                                    end = end.replace(/\s/g, '0');
                                });
                                
                                ranges[task].end = end;
                                series_callback(null);
                            }
                        });
                    }
                ], function(error) {
                    if (error) {
                        return callback();
                    }
                    callback(null);
                });
            }, function(error) {
                if (error) {
                    res.status(500);
                    return next(error);
                }

                /* get the beginning date, end data of the experiment*/
                var keys = Object.keys(ranges);
                var very_begin = new Date("2200-01-01T00:00:00.000");
                very_begin = very_begin.getTime();
                var very_end = 0;
                var ranges_begin, ranges_end;
                keys.forEach(function (task) {
                    var begin = new Date(ranges[task].start);
                    begin = begin.getTime();
                    var end = new Date(ranges[task].end);
                    end = end.getTime();
                    if(begin < very_begin && begin > 0) {
                        very_begin = begin;
                        ranges_begin = ranges[task].start;
                    }
                    if(end > very_end) {
                        very_end = end;
                        ranges_end = ranges[task].end;
                    }
                });
                var begin_string = ranges_begin.toString().split(".");

                /* get the size of the experiment*/
                var max_size = 0;
                client.search({
                    index: dreamcloud_pwm_idx,
                    body: {
                        query: {
                            constant_score: {
                                filter: {
                                    range: {
                                        "@timestamp": {
                                            "gte": begin_string[0],
                                            "lte": ranges_end.toString()
                                        }
                                    }
                                }
                            }
                        }
                    },
                    searchType: 'count'
                }, function(error, response) {
                    if (error) {
                        res.status(500);
                        return next(error);
                    }
                    if (response.hits !== undefined) {
                        max_size = response.hits.total;

                        /*energy query*/
                        client.search({
                            index: dreamcloud_pwm_idx,
                            body: {
                                query: {
                                    constant_score: {
                                        filter: {
                                            range: {
                                                "@timestamp": {
                                                    "gte": begin_string[0],
                                                    "lte": ranges_end.toString()
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            size: max_size,
                            sort: [ "@timestamp:asc" ],
                        }, function(error, result) {
                            if (error) {
                                res.status(500);
                                return next(error);
                            }
                            var results = {};
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits;
                                var keys = Object.keys(only_results);
                                var x_values = [
                                    []
                                ];

                                /*
                                * traverse over all results
                                */
                                keys.reverse().forEach(function(key) {
                                    var data = only_results[key]._source;
                                    var timestamp = moment(data['@timestamp']).unix();

                                    if (data.type != "power") {
                                        return;
                                    }
                                    /*
                                     * aggregate relevant data
                                     */
                                    for (var key in data) {
                                        if (data.hasOwnProperty(key)) {
                                            if (skip_metrics.indexOf(key) > -1 || key == '')
                                                continue;
                                            var metric_name = key;

                                            if (!metrics || (metrics && metrics.indexOf(metric_name) > -1)) {
                                                var metric_values = results[key];
                                                if (!metric_values) {
                                                    metric_values = [];
                                                }
                                                var name = timestamp;
                                                var value = parseFloat(data[key]);
                                                if (value != undefined && name != undefined) {
                                                    var keys = x_values[metric_name];
                                                    if (!keys) {
                                                        x_values[metric_name] = {};
                                                    }
                                                    var y_values = x_values[metric_name][name];
                                                    if (!y_values) {
                                                        y_values = [];
                                                    }
                                                    y_values.push(value);
                                                    x_values[metric_name][name] = y_values;
                                                }
                                            }
                                        }
                                    }
                                }); 

                                /*
                                 * validate and modify values
                                 */
                                for (var key in x_values) {
                                    if (key == '0')
                                        continue;
                                    var results = [];

                                    /*
                                     * reduce amount of data for visualization
                                     */
                                    for (var timestamp in x_values[key]) {
                                        var values = x_values[key][timestamp];
                                        var sum = values.reduce(function(a, b) {
                                            return a + b;
                                        });
                                        var avg = sum / values.length;
                                        /*
                                         * only keep the average value per second
                                         */     
                                        results.push({
                                            x: parseInt(timestamp),
                                            y: avg
                                        });
                                    }
                                    global.push({
                                        name: key,
                                        data: results
                                    });
                                }
                                res.send(global);
                            } else {
                                res.send('No data in the DB');
                            }
                        });
                    }
                });
            });
        }
    });
});

module.exports = router;

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
var request = require('request');
var moment = require('moment');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.sendFile(__dirname + '/visualization.html');
});

/*
 * variable used by /visualization
 */
var skip_metrics = ['@timestamp', 'type', 'host', 'task' ];

/** @brief Transforms available data for visualization
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
        if (live == undefined) {
            if (response != undefined) {
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
                if (result.hits != undefined) {
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
                        var hostname = data['host'].substr(0, 6);

                        /*
                         * filter entries by hostname
                         */
                        if ((host != undefined) && (data.host != undefined) && (host != data.host) && (host != 'All Hosts')) {
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
                                if(metric_name.indexOf(hostname) < 0) {
                                    metric_name = key + '_' + hostname;
                                }
                                if(units[key] != undefined){
                                    metric_name += '(' + units[key] + ')'; 
                                }
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
            }
        });
    });
});

module.exports = router;
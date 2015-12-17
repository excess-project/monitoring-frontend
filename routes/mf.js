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
var router = express.Router();

/** @brief Downloading metric data either as JSON or CSV
 *
 * This GET request returns for a given experiment ID all available metric data
 * either as JSON or CSV.
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return metric data either formatted as JSON or CSV (a file)
 */
router.get('/download', function(req, res, next) {
    var idExe = req.query.id.toLowerCase();
    var json = req.query.json;
    var csv = req.query.csv;

    /*
     * switch between CSV and JSON
     */
    if (csv) {
        res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.csv');
    } else {
        res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.json');
    }
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    /*
     * first, detect how much data is available
     */
    request.get('http://localhost:3000/count/' + idExe)
        .on('data', function(body) {
            var totalHits = body;
            var responseParts = [];

            /*
             * fetch all the data
             */
            request
                .get('http://localhost:3000/executions/' + idExe + '?size=' + totalHits)
                .on('data', function(body) {
                    responseParts.push(body);
                })
                .on("end", function() {
                    var data = responseParts.join('');
                    if (csv) {
                        data = JSON2CSV(data);
                    }
                    res.end(data);
                })
                .on('error', function(error) {
                    res.send("Data is currently not available.");
                });
        })
        .on('error', function(error) {
            res.send("Data is currently not available.");
        });
});

/** @brief Converts JSON metric data to CSV format
 *
 * @param objArray metric data
 *
 * @return CSV formatted metric data
 */
function JSON2CSV(objArray) {
    var array = JSON.parse(objArray);;
    var str = '';
    var line = '';
    var metric_type = '';

    for (var i = 0; i < array.length; i++) {
        line = '';
        if (metric_type != array[i]['type']) {
            metric_type = array[i]['type']
            for (var index in array[i]) {
                line += index + ',';
            }
            line = line.slice(0, -1);
            str += line + '\r\n';
        }
        line = '';

        for (var index in array[i]) {
            line += array[i][index] + ',';
        }
        line = line.slice(0, -1);
        str += line + '\r\n';
    }
    return str;
};

/** @brief Returns the names of nodes where an experiment was executed on
 *
 * For a given experiment ID, this GET request return an array of hostnames,
 * where an agent was deployed during execution in order to fetch metric data.
 * This function is, for instance, used to fill the drop-down menu within the
 * visualization page.
 *
 * @param req the request object
 * @param res the response object
 *
 * @return a JSON document including hostnames
 */
router.get('/hostnames', function(req, res) {
    var id = req.query.id.toLowerCase(),
        max_num_hosts = 3,
        client = req.app.get('elastic');

    /*
     * first, determine the number of available samples
     */
    client.count({
        index: id
    }, function(error, response) {
        var count = 2000;
        if (response != undefined) {
            if (response.count >= 10000) {
                count = 10000;
            } else {
                count = response.count;
            }
        }

        /*
         * get all available samples, and retrieve individual hostnames
         */
        client.search({
            index: id,
            size: count,
            sort: ["Timestamp:desc"]
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
                var hostnames = [];
                if (result.hits != undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);

                    keys.reverse().every(function(key) {
                        var data = only_results[key]._source;
                        var hostname = data.hostname;
                        if (hostnames.length == max_num_hosts) {
                            return false;
                        } else if (hostname != undefined && hostnames.indexOf(hostname) < 0) {
                            /*
                             * add hostnames to a set
                             */
                            hostnames.push(hostname);
                            return true;
                        } else {
                            return true;
                        }
                    });
                    /*
                     * return hostnames
                     */
                    res.send(hostnames);
                } else {
                    res.send('No hostname in the DB');
                }
            }
        });

    });
});

/*
 * variable used by /visualization
 */
var skip_metrics = ['Timestamp', 'type', 'hostname'];

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
router.get('/visualization', function(req, res, next) {
    var id = req.query.id.toLowerCase(),
        metrics = req.query.metrics,
        live = req.query.live,
        client = req.app.get('elastic'),
        host = req.query.hostname;

    /*
     * first, determine the number of available database entries
     */
    client.count({
        index: id
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
            index: id,
            size: count,
            sort: ["Timestamp:desc"]
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
                        var timestamp = parseInt(data.Timestamp);

                        /*
                         * filter entries by hostname
                         */
                        if ((host != undefined) && (data.hostname != undefined) && (host != data.hostname)) {
                            return;
                        }

                        /*
                         * aggregate relevant data
                         */
                        for (var key in data) {
                            if (data.hasOwnProperty(key)) {
                                if (skip_metrics.indexOf(key) > -1 || key == '')
                                    continue;
                                if (!metrics || (metrics && metrics.indexOf(key) > -1)) {
                                    var metric_values = results[key];
                                    if (!metric_values) {
                                        metric_values = [];
                                    }
                                    var name = timestamp;
                                    var value = parseInt(data[key]);

                                    if (value != undefined && name != undefined) {
                                        var keys = x_values[key];
                                        if (!keys) {
                                            x_values[key] = {};
                                        }
                                        var y_values = x_values[key][name];
                                        if (!y_values) {
                                            y_values = [];
                                        }
                                        y_values.push(value);
                                        x_values[key][name] = y_values;
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

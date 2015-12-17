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
var request = require('request');


router.get('/download', function(req, res, next) {
    var idExe = req.query.id.toLowerCase();
    var json = req.query.json;
    var csv = req.query.csv;

    if (csv) {
        res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.csv');
    } else {
        res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.json');
    }
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    request.get('http://localhost:3000/count/' + idExe)
    .on('data', function (body) {
        var totalHits = body;
        var responseParts = [];

        request
        .get('http://localhost:3000/executions/'+idExe+'?size='+totalHits)
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

function JSON2CSV(objArray) {
    var array = JSON.parse(objArray);;
    var str = '';
    var line = '';
    var metric_type = '';

    for (var i = 0; i < array.length; i++) {
    line = '';
    if (metric_type != array[i]['type']){
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

router.get('/hostnames', function (req,res) {
    var id = req.query.id.toLowerCase(),
        max_num_hosts = 3,
        client = req.app.get('elastic');

    client.count({
        index: id
    }, function (error, response) {
        var count = 2000;
        if (response != undefined) {
            if (response.count >= 10000) {
                count = 10000;
            } else {
                count = response.count;
            }
        }
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
                        }
                        else if (hostname != undefined && hostnames.indexOf(hostname) < 0) {
                            hostnames.push(hostname);
                            return true;
                        }
                        else {
                            return true;
                        }
                    });
                    res.send(hostnames);
                } else {
                    res.send('No hostname in the DB');
                }
            }
        });

    });
});

var skip_metrics = [ 'Timestamp', 'type', 'hostname' ];
router.get('/visualization', function(req, res, next) {
    var id = req.query.id.toLowerCase(),
        metrics = req.query.metrics,
        live = req.query.live,
        client = req.app.get('elastic'),
        //host = req.param.hostname;
        host = req.query.hostname;

    client.count({
        index: id
    }, function (error, response) {
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
                    var x_values = [[]];

                    keys.reverse().forEach(function(key) {
                        var data = only_results[key]._source;
                        var timestamp = parseInt(data.Timestamp);
                        if ((host != undefined) && (data.hostname != undefined) && (host != data.hostname)) {
                            return;
                        }
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
                                    //hostnames[key].push = data.hostname;

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
                                        //metric_values.push({ x: name, y: value });
                                        //results[key] = metric_values;
                                    }
                                }
                            }
                        }
                    });
                    for (var key in x_values) {
                        if (key == '0')
                            continue;
                        var results = [];
                        for (var timestamp in x_values[key]) {
                            var values = x_values[key][timestamp];
                            var sum = values.reduce(function(a, b) { return a + b; });
                            var avg = sum / values.length;
                            results.push({ x: parseInt(timestamp), y: avg });
                        }
                        global.push({ name: key, data: results });
                    }
                    /*
                    for (key in results) {
                        global.push({ name: key, data: results[key] });
                    }
                    */
                    res.send(global);
                } else {
                    res.send('No data in the DB');
                }
            }
        });
    });
});

module.exports = router;

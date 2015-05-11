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


var skip_metrics = [ 'Timestamp', 'type', 'hostname' ];
router.get('/visualization', function(req, res, next) {
    var id = req.query.id.toLowerCase(),
        metrics = req.query.metrics,
        live = req.query.live,
        client = req.app.get('elastic');

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

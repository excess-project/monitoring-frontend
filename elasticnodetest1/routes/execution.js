var request = require('request');

/*
 * Just checking to see if the DB is up.
 */
exports.ping = function(client) {
  return function(req, res){
		client.info("",function(err,resp){
			if (err){
				console.log(err);
				res.send('No connection to ElasticSearch Cluster');
 			} else {
 				console.log(resp);
 				res.send(resp);
 			}
		});//client
	}
};

exports.time = function(client) {
    return function(req, res) {
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
    }
}

/*
 * Searching for the list of all benchmarks.
 */
exports.executions = function (client){
    return function(req, res){
        client.search({
            index: 'executions',
            size: 10000,
            sort: '_id:desc',
        }, function(err, result){
            if (result.hits != undefined){
                var only_results = result.hits.hits;
            //  var all_hits = result.hits;
            //  var execution_ID = result.hits._id;
            //  console.log(execution_ID);
                var es_result = [];
                var keys = Object.keys(only_results);

                var i = 0;
                keys.forEach(function(key){
                    i++;
                    var exeID = only_results[key]._id;
                    temporary = {"id":exeID,"Name":only_results[key]._source.Name, "Description":only_results[key]._source.Description,"Start_date":only_results[key]._source.Start_date,"Username":only_results[key]._source.Username,"Metrics":"<a href='#' onclick=searchMetrics('" + exeID + "') >Visualize </a> |<a href='#' onclick=exportMetrics('" + exeID + "','" + only_results[key]._source.Name + "') > Export</a> |<a href='#' onclick=statsMetrics('" + exeID + "') > Stats</a>"};

                    //temporary = {"id":exeID,"Name":"<a href='/executions/details/"+exeID + "'>"+only_results[key]._source.Name + "</a>","Description":only_results[key]._source.Description,"Metrics":"<a href='#' class = 'linkmetrics' rel = '" + exeID + "'>Choose metrics</a>"};
                    es_result.push(temporary);
                    //es_result.push(only_results[key]);
                    //console.log(temporary);
                    //console.log("Adding "+key+" number to result ");
                    //console.log(JSON.stringify(es_result[key]));
                    //console.log("The ID for this one is "+only_results[key]._id+" \n")
                });
                res.send(es_result);
            } else {
	  	res.send('No data in the DB');
            }
	})
    }
};

/*
 * Show more information about the execution.
 */
exports.details = function(client){
	return function(req, res){
  	client.get({
    	index:'executions',
        type: 'TBD',
        id: req.params.ID
    },
    function(err, result)
    {
      //console.log(result);
      if (result.found != false){
      	res.send(result._source);
      } else {
      	res.send('Requested resource was Not found');
      }
    })
	}
};

/*
 * Searching metrics of a specific execution.
 */
exports.metrics = function (client){
    return function(req, res){
    var id = req.params.ID.toLowerCase();
	client.indices.getMapping({
            index:req.params.ID.toLowerCase(),
        },
        function(err, result){
        if (err){
            console.log('Error searching metrics of a specific execution: '+err);
            //res.send('No data in the DB');
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
}
};

exports.totalHits = function(client) {
    return function(req, res) {
        client.count({
            index: req.params.ID.toLowerCase()
        }, function (error, response) {
            if (error) {
                res.send('1000');
            } else if (response) {
                console.log(response.count.toString());
                res.send(response.count.toString());
            } else {
                res.send('1000');
            }
        });
    }
}

/*
 * Show stats of a specific execution, filter by range.
 */
exports.stats = function (client){
    return function(req, res){
    var metric_name = req.params.metric;
    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
      //client.indices.getMapping({
    	index:req.params.ID.toLowerCase(),
        size:0,
        body: {
            aggs:{
                range_metric : {
                    filter: {range: {"Timestamp" : { "from" : from_time, "to" : to_time }}},
                    aggs: {"extended_stats_metric" : { extended_stats : { "field" : metric_name }}}
                    //aggs: {"extended_stats_metric" : { extended_stats : { "field" : "_all" }}}
                    //aggs: {"extended_stats_rating" : { extended_stats : { "script" : "doc['_source'].value" }}}
                }
            }
        } //end body

        /*body: {
            query: {
                constant_score: {
                    filter: {range: {"Timestamp" : { "from" : from_time, "to" : to_time }}}
                }
            },
            aggs: {"extended_stats_metric" : { extended_stats : { "field" : metric_name }}}
        } */
    },
        function(err, result){
            //console.log(result);
            //console.log("Keys >> "+Object.keys(result));
            if (result.hits != undefined){
	  	var only_results = result.aggregations.range_metric.extended_stats_metric;
                res.send(only_results);
                //res.send(result);
            } else {
	  	res.send('No data in the DB');
	    }
	  })
    }
};

exports.download = function(client) {
    return function(req, res) {
        var idExe = req.params.ID.toLowerCase();
        var json = req.query.json;
        var csv = req.query.csv;

        if (csv) {
            res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.csv');
        } else {
            res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.json');
        }
        res.setHeader('Content-type', 'text/plain');
        res.charset = 'UTF-8';

        request
        .get('http://localhost:3000/count/' + idExe)
        .on('data', function (body) {
            var totalHits = body;

            totalHits = 10;

            request
            .get('http://localhost:3000/executions/'+idExe+'?size='+totalHits)
            .on('data', function(body) {
                if (csv) {
                    body = JSON2CSV(body);
                }
                res.write(body);
                res.end();
            })
            .on('error', function(error) {
                res.send("Data is currently not available.");
            });
        })
        .on('error', function(error) {
            res.send("Data is currently not available.");
        });
    }
};

function JSON2CSV(objArray) {
    var array = JSON.parse(objArray);; //typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    var str = '';
    var line = '';
    var metric_type = '';

    for (var i = 0; i < array.length; i++) {
    line = '';
        //include the header of each metric type
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

/*
$.getJSON('/count/' + idExe)
        .done(function(data) {
            var totalHits = data;
            $.getJSON('/executions/'+idExe+'?size='+totalHits, function (data) {
                // Stick our metric data array into a metricsData variable in the global object
                executionsData = data;
                if(Array.isArray(executionsData)){
                    message+="<form name='MetricPopup' style='margin-top: 2px;'>";
                    message+="<input type='button' value='Download CSV' onclick='JSON2CSV("+JSON.stringify(executionsData)+");' onBlur='window.close();' /><span>&nbsp;</span>";
                    message+="<input type='button' value='Download JSON' onclick='saveJSON("+JSON.stringify(executionsData)+");' onBlur='window.close();' /><br>";
                    message+="</form></br>";
                    metricWindow.document.write(message);
                    message='';
                }
            });//jQuery AJAX call for JSON
        })
        .always(function(data) {
            res.setHeader('Content-disposition', 'attachment; filename=' + idExe + '.txt');
            res.setHeader('Content-type', 'text/plain');
            res.charset = 'UTF-8';
            res.write(executionData);
            res.end();
        });
*/

/*
 * Searching for the values of a specific benchmark.
 */
exports.values = function(client, result_size){
    return function(req, res){
        var from_time = req.params.from;
        var to_time = req.params.to;
        if (req.query.size) {
            result_size = req.query.size;
        }

	   client.search({
            index:req.params.ID.toLowerCase(),
            size: result_size,
            //sort:["Timestamp"],
            sort:["type", "Timestamp"],
        },function(err, result){
            if (err){
                console.log('Error searching for the values of a specific benchmark: '+err);
                res.send(err);
            }
            else{
                if (result.hits != undefined){
                    var only_results = result.hits.hits;
                    var es_result = [];
                    var keys = Object.keys(only_results);

                    keys.forEach(function(key){
                        es_result.push(only_results[key]._source);
                        //console.log("Adding "+key+" number to result ");
                        //console.log(JSON.stringify(es_result[key]));
                    });
                    res.send(es_result);
                } else {
                    res.send('No data in the DB');
                }
            } //if error
        })
    }
};

exports.livedata = function(client) {
    return function(req, res){
    var metrics = req.query['metric'];

    client.search({
        index: req.params.ID.toLowerCase(),
        size: 1000,
        sort: ["Timestamp:desc"],
        },function(err, result){
            if (err){
                console.log('Error searching for the values of a specific benchmark: '+err);
                res.send(err);
            }
            else{
                var global = [];
                var results = {};
                if (result.hits != undefined){
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);


                    keys.reverse().forEach(function(key){
                        var data = only_results[key]._source;
                        var timestamp = data.Timestamp;

                        for (var key in data) {
                            if (data.hasOwnProperty(key)) {
                                if (!metrics || (metrics && metrics.indexOf(key) > -1)) {
                                    var metric_values = results[key];
                                    if (!metric_values) {
                                        metric_values = [];
                                    }
                                    metric_values.push({ x: data['Timestamp'], y: data[key] });
                                    results[key] = metric_values;
                                }
                            }
                        }
                    });
                    for (key in results) {
                        global.push({ name: key, data: results[key] });
                    }
                    res.send(global);
                    console.log(global);
                } else {
                    res.send('No data in the DB');
                }
            } //if error
        })
    }
};

/*
 * Preparing monitoring data for visualization.
 */
exports.monitoring = function (client){
    return function(req, res){
    var metrics = req.query['metrics'];
    var from = req.query['from'];
    var to = req.query['to'];

	client.search({
        index: req.params.ID.toLowerCase(),
        size: 1000,
        sort: ["Timestamp:desc"],
        body: {
            query: {
                constant_score: {
                    filter: {
                        range: {
                            "Timestamp" : { "from" : from, "to" : to }
                        }
                    }
                }
            }
        }
        },function(err, result){
            if (err){
                console.log('Error searching for the values of a specific benchmark: '+err);
                res.send(err);
            }
            else{
                var global = [];
                var results = {};
                if (result.hits != undefined){
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);


                    keys.reverse().forEach(function(key){
                        var data = only_results[key]._source;
                        var timestamp = data.Timestamp;

                        for (var key in data) {
                            if (data.hasOwnProperty(key)) {
                                if (!metrics || (metrics && metrics.indexOf(key) > -1)) {
                                    var metric_values = results[key];
                                    if (!metric_values) {
                                        metric_values = [];
                                    }
                                    metric_values.push({ x: data['Timestamp'], y: data[key] });
                                    results[key] = metric_values;
                                }
                            }
                        }
                    });
                    for (key in results) {
                        global.push({ name: key, data: results[key] });
                    }
                    res.send(global);
                    console.log(global);
                } else {
                    res.send('No data in the DB');
                }
            } //if error
        })
    }
};

/*
 * Searching for the values of a specific benchmark, filter by range.
 */
exports.range = function (client){
	return function(req, res){
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
      }},
      function(err, result)
 			{
 			  if (result.hits != undefined){
	  			var only_results = result.hits.hits;
	  			var es_result = [];
	  			var keys = Object.keys(only_results);

	  			keys.forEach(
	  				function(key)
	  				{
        			es_result.push(only_results[key]._source);
        			//console.log("Adding "+key+" number to result ");
        			//console.log(JSON.stringify(es_result[key]));
        		});
	  			res.send(es_result);
	  		} else {
	  			res.send('No data in the DB');
	  		}
	  })
	}
};

/*
 * Adding a new execution and respond the provided ID.
 */
exports.insert = function (client){
    return function(req, res){
  	var the_json = req.body;
  	//console.log("The request body is: ");
  	//console.log(the_json);
        var exit = false;
        (function loopStartWith() {
            if (exit === false) {
                client.index({index:'executions',type: 'TBD', body:the_json},function(err,es_reply){
                    if (!err) {
                        if ( (/^_/).test(es_reply._id) ) {
                            //Delete the created execution
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
                            /*
                            //Validation that the execution ID in lower case is not already saved on the DB
                            client.indices.exists({index: es_reply._id.toLowerCase()}, function(err, response, status) {
                                if (status === 200) {
                                    console.log("Deleted Execution id that in lower case has saved data on the DB: "+es_reply._id);
                                    //Delete the created execution
                                    client.delete({index: 'executions',type: 'TBD',id: es_reply._id}, function (error, response) {});
                                    exit = false;
                                }
                                else{
                                    exit = true;
                                    res.send(es_reply._id);
                                }
                            });
                            */
                            exit = true;
                            res.send(es_reply._id);
                        }
                    }
                loopStartWith();
                });
            }
        }());
    }
};

/*
 * Adding a new time to an existing execution and respond the provided ID.
 */
exports.add = function (client){
	return function(req, res){
  	var the_json = req.body;
	client.index({index:req.params.ID.toLowerCase(),type: 'TBD',body:the_json},function(err,es_reply){
            //console.log(es_reply);
            res.send(es_reply);
  	});
	}
};



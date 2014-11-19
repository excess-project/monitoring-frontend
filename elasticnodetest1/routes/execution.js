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

/*
 * Searching for the list of all benchmarks.
 */
exports.executions = function (client){
    return function(req, res){
        client.search({index:'executions',size:10000}, function(err, result){ 
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
                    temporary = {"id":exeID,"Name":only_results[key]._source.Name, "Description":only_results[key]._source.Description,"Start_date":only_results[key]._source.Start_date,"Username":only_results[key]._source.Username,"Metrics":"<a href='#' onclick=searchMetrics('" + exeID + "') >Choose </a> |<a href='#' onclick=exportMetrics('" + exeID + "') > Export</a> |<a href='#' onclick=statsMetrics('" + exeID + "') > Stats</a>"};

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

/*
 * Searching for the values of a specific benchmark.
 */
exports.values = function (client){
    return function(req, res){
        var from_time = req.params.from;
        var to_time = req.params.to;

	client.search({
            index:req.params.ID.toLowerCase(), 
            size:10000,
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

/*
 * Preparing monitoring data for visualization.
 */
exports.monitoring = function (client){
    return function(req, res){
        var from_time = req.params.from;
        var to_time = req.params.to;

	client.search({
            index:req.params.ID.toLowerCase(), 
            size:10000,
            sort:["Timestamp"],           
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



// DOM Ready =============================================================

$(document).ready(function() {

// Populate the table on initial page load
$.ajax({
  url: '/executions',
  success: function(data){
    $('#executions').dynatable({
      dataset: {
        records: data
      }
    });
  }
});//$.ajax

});//$(document)

// Functions =============================================================
function searchMetrics(idExe) {

    metricWindow = window.open( '',
        'metricWindow', 'menubar=no,location=no,status=no,directories=no,toolbar=no,scrollbars=yes,top=400,left=400,height=200,width=350'
    );

    var message = '';
	message="<font face='verdana, arial, helvetica, san-serif' size='2'>";
	message+="<form name='MetricPopup' action='/visualization' method='GET' target='_blank'>";
	message+="<input type='hidden' name='index' value='"+ idExe +"'> <br>";
	message+="From: <input type='text' name='from'> <br>";
	message+="To: <input type='text' name='to'> <br>";

    // jQuery AJAX call for JSON
    $.getJSON( '/executions/metrics/'+idExe, function( data ) {
        // Stick our metric data array into a metricsData variable in the global object
        var metricsData = data;
	var i=0;    
	metricsData.forEach(function(value) {
            i+=1;
            message+="<input type='checkbox' name='metric"+ i +"' value='"+ value +"'>" + value +"<br>";
	});

	message+="<p><input type='submit' value='Visualization' onBlur='window.close();'> </p>";
	message+="</form>";
	message+="</font>";
	metricWindow.document.write(message);
    });//jQuery AJAX call for JSON
};

function statsMetrics(idExe) {

    metricWindow = window.open( '',
        'metricWindow', 'menubar=no,location=no,status=no,directories=no,toolbar=no,scrollbars=yes,top=400,left=400,height=300,width=450'
    );

    var message = '';
	message="<font face='verdana, arial, helvetica, san-serif' size='2'>";         
        message+="<script type='text/javascript' src='/javascripts/jquery.js'></script>";
        message+="<script type='text/javascript' src='/javascripts/global.js'></script>";
	message+="<form name='MetricPopup'>";
	message+="<input type='hidden' id='index' value='"+ idExe +"'> <br>";
	message+="From: <input type='text' id='from' value='1406113460'> <br>";
	message+="To: <input type='text' id='to' value='1406113466'> <br>";
    
    // jQuery AJAX call for JSON    
    $.getJSON( '/executions/metrics/'+idExe, function( data ) {
        // Stick our metric data array into a metricsData variable in the global object
        var metricsData = data;	
	metricsData.forEach(function(value) {            
            message+="<input type='checkbox' name='metric' value='"+ value +"'>" + value +"<br>";
	});
        //message+="<input type='button' value='Calculate'  onClick='stats();' onBlur='window.close();' />";    
        //message+="<input type='button' value='Calculate' id='btnCalculate' onClick='stats();'  />";    
        message+="<input type='button' value='Calculate' id='btnCalculate' onClick='stats();' />";    
        message+="<input type='button' value='Close' onClick='window.close();'/><br>";
        //message+="<textarea id='txt'cols=40 rows=10></textarea> <br>";
        message+="<p id='stats'> </p>";
	message+="</form>";
	message+="</font>";
	metricWindow.document.write(message);
    });//jQuery AJAX call for JSON
};

function stats() {

    var metric_names = document.getElementsByName("metric");    
    var idExe = document.getElementById("index").value;        
    var from = document.getElementById("from").value;        
    var to = document.getElementById("to").value;                    

    var result = '';
    var metric = '';
    for (var i = 0; i < metric_names.length; i++) {
        if (metric_names[i].checked){                        
            metric = metric_names[i].value;
            result += "\r\n --metric: " + metric;                        
            //function to get stats            
            $.getJSON( '/execution/stats/'+idExe+'/'+metric+'/'+from+'/'+to, function( data ) {                                           
                var statsData = data;	                
                var items = Object.keys(statsData);
                items.forEach(function(item) {                    
                    result += " " + item + ':' + statsData[item] + " ";                                                            
                });                                
                result += '\r\n';       
            });                                                
        }        
        alert('iteration: ' + i);            
    }       
    document.getElementById("stats").innerHTML = result;                        
};

function exportMetrics(idExe) {

    metricWindow = window.open( '',
        'metricWindow', 'menubar=no,location=no,status=no,directories=no,toolbar=no,scrollbars=yes,top=400,left=400,height=350,width=600'
    );

    var message = '';
	message="<font face='verdana, arial, helvetica, san-serif' size='2'>";
        message+="<script type='text/javascript' src='/javascripts/global.js'></script>";
        message+="<form name='MetricPopup' >";
    // jQuery AJAX call for JSON
    $.getJSON( '/executions/'+idExe, function( data ) {
        // Stick our metric data array into a metricsData variable in the global object
        executionsData = data;
	message+="<textarea id='txt'cols=80 rows=10>"+JSON.stringify(executionsData)+"</textarea> <br>";		
	message+="<input type='button' value='Download CSV' onclick='JSON2CSV("+JSON.stringify(executionsData)+");' onBlur='window.close();' />";    
	message+="<input type='button' value='Download JSON' onclick='saveJSON("+JSON.stringify(executionsData)+");' onBlur='window.close();' /><br>";
	message+="</form>";
	message+="</font>";
	metricWindow.document.write(message);
    });//jQuery AJAX call for JSON
};

function JSON2CSV(objArray) {
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
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
    window.open("data:text/csv;charset=utf-8," + escape(str))
    return str;    
};

function saveJSON(objArray){
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    window.open("data:text/json;charset=utf-8," + JSON.stringify(array))
};

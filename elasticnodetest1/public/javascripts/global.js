// DOM Ready =============================================================

function setTableWidth() {
    var i = 2;
    var j = 0;

    $('#executions > tbody > tr > td')
    .filter(function() {
        if (j == 2) {
            j=j+1;
            i=i+6;
            return 1;
        }
        if (j==i) {
            j=j+1;
            i=i+6;
            return 1;
        }
        j=j+1;
        return 0;
    })
    .addClass('width-variable');
}

$(document).ready(function() {

// Populate the table on initial page load
$.ajax('/executions')
    .done(function(data){
        $('#executions')
        .dynatable({
            dataset: {
                records: data,
                perPageDefault: 10,
                perPageOptions: [10,20,50,100],
            },
            features: {
                paginate: true,
                recordCount: true,
                sorting: true,
                search: true
            },
            inputs: {
                processingText: 'Loading <img src="https://s3.amazonaws.com/dynatable-docs-assets/images/loading.gif" />'
            },
            writers: {
                Name: function(record) {
                    var name = record.Name;
                    name = "<span id='tooltip' title='Experiment ID: " + record.id + "'>" + name + "</span>";
                    return name;
                },
                Start_date: function(record) {
                    record.parsedDate = record.Start_date*1000;
                    var date = new Date(record.Start_date*1000);
                    if (date == 'Invalid Date') {
                        date = moment(new Date(record.Start_date)).unix();
                        record.parsedDate = date*1000;
                        date = new Date(date*1000);
                        if (date == 'Invalid Date') {
                            console.log("Invalid Date: " + record.Start_date + " inserted by user " + record.Name);
                            date = moment().startOf('year');
                            record.parsedDate = date.unix();
                            date = date.toString() + " <span id='tooltip' title='Invalid date found: " + record.Start_date + "'> (**)</span>";
                        }
                    }
                    return date;
                }
            }
        });
    })
    .always(function() {
        setTableWidth();
    })
; //$.ajax

});//$(document)

// Functions =============================================================
function searchMetrics(idExe) {

    metricWindow = window.open( '',
        'metricWindow', 'menubar=no,location=no,status=no,directories=no,toolbar=no,scrollbars=yes,top=400,left=400,height=200,width=350'
    );

    var message = '';
	message="<font face='verdana, arial, helvetica, san-serif' size='2'>";

    // jQuery AJAX call for JSON
    $.getJSON( '/executions/metrics/'+idExe, function( data ) {
        // Stick our metric data array into a metricsData variable in the global object
        var metricsData = data;
        var i=0;
        message+="<form name='MetricPopup' action='/visualization' method='GET' target='_blank'>";

//        if(Object.prototype.toString.call(metricsData).slice(8, -1) == 'Array'){
        if(Array.isArray(metricsData)){
            message+="<input type='hidden' name='index' value='"+ idExe +"'> <br>";
            message+="From: <input type='text' name='from'> <br>";
            message+="To: <input type='text' name='to'> <br>";
            metricsData.forEach(function(value) {
                i+=1;
                message+="<input type='checkbox' name='metric"+ i +"' value='"+ value +"'>" + value +"<br>";
            });
            message+="<p><input type='submit' value='Visualization' onBlur='window.close();'> </p>";
        }
        else{
            message+="<br><br>Error: No data in the DB for this execution ID: "+idExe;
        }
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

    // jQuery AJAX call for JSON
    $.getJSON( '/executions/metrics/'+idExe, function( data ) {
        // Stick our metric data array into a metricsData variable in the global object
        var metricsData = data;
        if(Array.isArray(metricsData)){
            message+="<input type='hidden' id='index' value='"+ idExe +"'> <br>";
            message+="From: <input type='text' id='from' value=''> <br>";
            message+="To: <input type='text' id='to' value=''> <br>";
            metricsData.forEach(function(value) {
                message+="<input type='checkbox' name='metric' value='"+ value +"'/>" + value +"<br>";
            });
            message+="<input type='button' value='Calculate' id='btnCalculate' onClick='stats();' />";
            message+="<input type='button' value='Close' onClick='window.close();'/><br>";
            message+="<p id='stats'><p>";

        }
        else{
            message+="<br><br>Error: No data in the DB for this execution ID: "+idExe;
        }
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
    for (var i = 0; i < metric_names.length; i++) {
        if (metric_names[i].checked){
            var metric = '';
            metric = metric_names[i].value;
            //to perform a synchronous getJSON
            $.ajaxSetup({
                async: false
            });
            //function to get stats
            $.getJSON( '/execution/stats/'+idExe+'/'+metric+'/'+from+'/'+to, function( data ) {
                var statsData = data;
                result +=  "<b>"+metric+": </b>";
                var items = Object.keys(statsData);
                items.forEach(function(item) {
                    result += " " + item + ':' + statsData[item] + " ";
                });
                result +="<br>";
            });
            document.getElementById("stats").innerHTML = result;
            $.ajaxSetup({
                async: true
            });
        }
    }
    document.getElementById("stats").innerHTML = all_stats;
};

function exportMetrics(idExe, jobID) {
    metricWindow = window.open('',
        'metricWindow', 'menubar=no,location=no,resizable=no,scrollbars=no,status=yes,top=400,left=400,height=350,width=600'
    );
    metricWindow.document.write('<html><head><title>EXCESS Data Export for Job ID &lt;' + jobID + '&gt;</title></head><body height="100%" width="100%"></body></html>');

    var message = '';
    message+='<script src="http://code.jquery.com/jquery-1.10.2.js"></script>';
    message+='<script src="http://code.jquery.com/ui/1.11.4/jquery-ui.js"></script>';
    message+="<script type='text/javascript' src='/javascripts/global.js'></script>";
    message+='<script>$(function() { $( "#resizable" ).resizable({ handles: "se" }); });</script>';
    message="<font face='verdana, arial, helvetica, san-serif' size='2'>";
    message+="<h3>EXCESS Data Export for Job ID &lt;" + jobID + "&gt;</h3>";
    metricWindow.document.write(message);
    message='';

    $.ajax({
        dataType: "json",
        async: true,
        url: '/executions/metrics/'+idExe,
        success: function(data) {
            if (Array.isArray(data)) {
                message+="<b>Profiled Metrics</b>:";
                message+="<ul style='margin-top: 2px;'>";
                data.forEach(function(value) {
                    if (value != 'hostname') {
                        message+="<li>"+value+"</li>";
                    }
                });
                message+="</ul></br>";
            }
            metricWindow.document.write(message);
            message='';
        }
    });
    // jQuery AJAX call for JSON
    $.getJSON( '/preview/'+idExe, function (data) {
        message+='<b>Preview (JSON):</b></br>';
        // Stick our metric data array into a metricsData variable in the global object
        executionsData = data;
        if(Array.isArray(executionsData)){
            message+='<textarea id="resizable" rows="10" cols="50" style="margin-top: 2px">'+JSON.stringify(executionsData, undefined, 4)+"</textarea></br></br>";
        }
        metricWindow.document.write(message);
        message='';
    });//jQuery AJAX call for JSON


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
    .fail(function(jqXHR, textStatus, errorThrown) {
        console.log( "error: " + textStatus);
    })
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
    window.open("data:text/csv;charset=utf-8," + escape(str));
    return str;
};

function saveJSON(objArray){
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    window.open("data:text/json;charset=utf-8," + JSON.stringify(array));
    return array;
};

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
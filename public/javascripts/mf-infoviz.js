function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split(/[&\?]/);
    for (var i = 0; i < sURLVariables.length; i++)
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam)
        {
            return sParameterName[1];
        }
    }
}

var executionID = getUrlParameter("id");
var metrics = getUrlParameter("metrics");
var isLive = getUrlParameter("live");

var seriesData;
var request = '/mf/visualization?id=' + executionID;
if (metrics != undefined) {
    request += "&metrics=" + metrics;
}
if (isLive != undefined) {
    request += "&live=" + isLive;
}

$.getJSON(request)
.done(function(data) {
    seriesData = data;
})
.always(function() {
    visualize();
});

function visualize() {

var palette = new Rickshaw.Color.Palette( { scheme: 'classic9' } );

$(seriesData).each(function(i) {
    seriesData[i].color = palette.color();
});

var graph = new Rickshaw.Graph( {
    element: document.getElementById("chart"),
    width: 900,
    height: 500,
    renderer: 'area',
    stack: false,
    stroke: true,
    preserve: true,
    series: seriesData,
} );

graph.render();

var preview = new Rickshaw.Graph.RangeSlider( {
    graph: graph,
    element: document.getElementById('preview'),
} );

var hoverDetail = new Rickshaw.Graph.HoverDetail( {
    graph: graph,
    xFormatter: function(x) {
        return new Date(x * 1000).toString();
    }
} );

var legend = new Rickshaw.Graph.Legend( {
    graph: graph,
    element: document.getElementById('legend')

} );

var shelving = new Rickshaw.Graph.Behavior.Series.Toggle( {
    graph: graph,
    legend: legend
} );

var order = new Rickshaw.Graph.Behavior.Series.Order( {
    graph: graph,
    legend: legend
} );

var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight( {
    graph: graph,
    legend: legend
} );

var smoother = new Rickshaw.Graph.Smoother( {
    graph: graph,
    element: document.querySelector('#smoother')
} );

var ticksTreatment = 'glow';

var xAxis = new Rickshaw.Graph.Axis.Time( {
    graph: graph,
    ticksTreatment: ticksTreatment,
    timeFixture: new Rickshaw.Fixtures.Time.Local()
} );

xAxis.render();

var yAxis = new Rickshaw.Graph.Axis.Y( {
    graph: graph,
    orientation: 'left',
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    ticksTreatment: ticksTreatment,
    element: document.getElementById('y_axis'),
} );

yAxis.render();

var controls = new RenderControls( {
    element: document.querySelector('form'),
    graph: graph
} );

if (isLive != undefined) {
    var interval = parseInt(isLive);
    if (interval == undefined) {
        interval = 1;
    }
    interval = interval * 1000;
    setInterval(function() {
        $.getJSON(request)
        .done(function(data) {
            $(graph.series).each(function(i){
                data[i].color = graph.series[i].color;
                graph.series[i] = data[i];
            });
        })
        .always(function() {
            graph.render();
        });
    }, interval);
}

}
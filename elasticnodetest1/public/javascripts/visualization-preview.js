$(document).ready(function() {

    var ID = $('#index').val();
    $.getJSON('/executions/' + ID + '/time')
    .done(function(data) {
        var start = data.start * 1000;
        start = moment(new Date(start));
        var end = data.end * 1000;
        end = moment(new Date(end));

        $('#from_real').datetimepicker({
            timeFormat: 'HH:mm:ss.l',
            stepHour: 1,
            stepMinute: 1,
            stepSecond: 1,
            hour: start.hour(),
            minute: start.minute(),
            millisec: start.milliseconds(),
        }).val(moment(new Date(start)).format("MM/DD/YYYY HH:mm:ss.SSS"));

        $('#to_real').datetimepicker({
            timeFormat: 'HH:mm:ss.l',
            stepHour: 1,
            stepMinute: 1,
            stepSecond: 1,
            hour: end.hour(),
            minute: end.minute(),
            millisec: end.milliseconds(),
        }).val(moment(new Date(end)).format("MM/DD/YYYY HH:mm:ss.SSS"));
    });

    $('#live').click(function(e) {
        e.preventDefault;
        console.log(e);
    });

    /* TODO: add some validation if the incoming date format is wrong */
    $('#submit_button').click(function(e) {
        e.preventDefault();
        var start = moment($('#from_real').val(), "MM/DD/YYYY HH:mm:ss.SSS");
        var end = moment($('#to_real').val(), "MM/DD/YYYY HH:mm:ss.SSS");
        if (start && end) {
            if (start >= end) {
                return;
            }
            $('#from').val(start.unix());
            $('#to').val(end.unix());
            $('#visualize').submit();
        }
    });
});
Rickshaw.namespace('Rickshaw.Fixtures.Number');

Rickshaw.Fixtures.Number.formatSeconds = function(y) {
    var abs_y = Math.abs(y);
    if (abs_y === 0)         { return '0' }
    else                     { return y + "s"}
};

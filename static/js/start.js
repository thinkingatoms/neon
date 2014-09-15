/**
 *
 * FiPod - a Brainless app
 *
 */

// Brainless.controller function defined in static/js/brainless.js
// arguments are widgetName, parent element/object, target element/object, config
var Main = Brainless.controller('app', null, null, FIPOD); // jshint ignore:line

$(document).on('pagecreate', '.thinkingatoms', function() {
  $(Main).app('setup');
});

$(window).on('beforeunload', function() {
  Main.log('goodbye');
  $(Main).app('destroy');
});

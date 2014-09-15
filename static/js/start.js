/**
 *
 * FiPod - a Brainless app
 *
 */
var Main = Brainless.controller('app', null, null, FIPOD); // jshint ignore:line

$(document).on('pagecreate', '.thinkingatoms', function() {
  $(Main).app('setup');
});

$(window).on('beforeunload', function() {
  Main.log('goodbye');
  $(Main).app('destroy');
});

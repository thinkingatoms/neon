
FiPod
=====

FiPod is a single-page mobile-friendly web application
that uses websockets, localstorage, d3 and jQuery.

Flow
----

The flow basically goes:

1. get configuration from static/js/fipod/data.js

2. create an "app" in [start.js](static/js/start.js), which is
   basically a jQuery widget

3. the app, defined in [controller.js](static/js/fipod/controller.js),
   will create modular jQuery widgets that deal with
   various aspects of the apps

4. widgets would create [models](/static/js/fipod/model.js) as needed
   and listen on model changes

5. when models change, some widget function is triggered,
   and depending on whether the widget is created on
   a DOM element, may update the view.

More code coming soon, please stay tuned.


Brainless
---------

It includes a DIY MV\* [skeleton](static/js/brainless.js) that
doesn't get in the way when you want a quick and dirty
single-page app, but is still structured for extensions.
There's no additional templating language or unnecessary
things just to have it work -- just straight up jQuery widgets.

App controllers are created as modular stateful jQuery widgets,
utilizing the slew of established event handling,
OOP inheritance, and other pluses.

To learn more about jQuery widgets:
* http://learn.jquery.com/jquery-ui/widget-factory/why-use-the-widget-factory/
* http://msdn.microsoft.com/en-us/library/hh404085.aspx

Widgets can have other widgets as children.
Any JS object can be attached to one or multiple widgets.

There are basically two types of controllers:
* widgets created on a plain JS object - more traditional controller
* widgets created on a DOM jQuery element - more like view(model)

FiPod controllers on plain objects:
* [static/js/fipod/controller.js](static/js/fipod/controller.js) (includes widgets 'thinkingatoms.app', 'thinkingatoms.fipod')
* [static/js/fipod/server.js](static/js/fipod/server.js) - (other widgets created at the app level)

FiPod controllers for DOM elements are located in:
* [static/js/fipod/view.js](static/js/fipod/view.js)


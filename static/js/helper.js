/* jshint unused:false */

// Helpers
if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
  };
}

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function(str) {
    return this.slice(0, str.length) == str;
  };
}

if (typeof String.prototype.contains != 'function') {
  String.prototype.contains = function(it) {
    return this.indexOf(it) != -1;
  };
}

if (typeof String.prototype.repeat != 'function') {
  String.prototype.repeat = function(num) {
    return new Array(num + 1).join(this);
  };
}

// OOP
Function.prototype.subclass = function(base, sub) {
  this.prototype = Object.create(base.prototype);
  if (sub)
    $.extend(this.prototype, sub);
};


// Debug
if (DEBUG) {
  Function.prototype.trace = function() {
    var trace = [];
    var current = this;
    while (current) {
      trace.push(current.signature());
      current = current.caller;
    }
    return trace;
  };

  Function.prototype.signature = function() {
    var signature = {
      name: this.getName(),
      params: [],
      toString: function() {
        var params = this.params.length > 0 ? "'" + this.params.join("', '") +
          "'" : "";
        return this.name + "(" + params + ")";
      }
    };
    if (this.arguments) {
      for (var x = 0; x < this.arguments.length; x++)
        signature.params.push(this.arguments[x]);
    }
    return signature;
  };

  Function.prototype.getName = function() {
    if (this.name)
      return this.name;
    var definition = this.toString().split("\n")[0];
    var exp = /^function ([^\s(]+).+/;
    if (exp.test(definition))
      return definition.split("\n")[0].replace(exp, "$1") || "anonymous";
    return "anonymous";
  };
}

// Data Structures / Values

/**
 * Hash of Arrays
 * @constructor
 * @param {object} opt - options
 *    ignoreDups - ignore any duplicates in the array, default: false
 */
function HoA() {}
//this.ignoreDups = opt && opt.ignoreDups;
HoA.prototype.get = function(key) {
  return this[key];
};
HoA.prototype.set = function(key, val) {
  var i, list = this.get(key);
  if (!list)
    list = this[key] = [];
  if (!this.ignoreDups)
    for (i in list)
      if (val === list[i])
        return;
  list.push(val);
};
HoA.prototype.del = function(key, val) {
  var i, list = this.get(key);
  for (i in list)
    if (val === list[i]) {
      list.splice(i, 1);
      break;
    }
  if (!list.length)
    delete this[key];
};
HoA.prototype.destroy = function() {
  var i, list, that = this;
  for (i in that) {
    list = that[i];
    if ($.isArray(list))
      delete that[i];
  }
};

/**
 * Hash of Hashes
 * @constructor
 */
function HoH() {}
HoH.prototype.get = function(key, subkey) {
  if (this[key])
    return this[key][subkey];
  return undefined;
};
HoH.prototype.set = function(key, subkey, val) {
  if (val === undefined) {
    this.del(key, subkey);
    return;
  }
  if (subkey !== undefined) {
    if (!this[key])
      this[key] = {};
    this[key][subkey] = val;
  } else {
    this[key] = val;
  }
};
HoH.prototype.del = function(key, subkey) {
  if (subkey !== undefined) {
    if (!this[key])
      return;
    delete this[key][subkey];
    if ($.isEmptyObject(this[key]))
      delete this[key];
  } else {
    delete this[key];
  }
};
HoH.prototype.destroy = function() {
  var i, j, dict, that = this;
  for (i in that) {
    dict = that[i];
    if ($.isPlainObject(dict))
      for (j in dict)
        delete dict[j];
    delete that[i];
  }
};

function A2HoA(list, value) {
  var i, hoa;
  if (!$.isArray(list))
    return list;
  if (!$.isArray(value))
    value = undefined;
  hoa = new HoA();
  for (i in list)
    hoa[list[i]] = value || [];
  return hoa;
}

function UUID(prefix) {
  if (!prefix)
    prefix = prefix || 'uuid';
  return prefix + (++LAST_UUID_SUFFIX);
}

function encodeMeta(meta) {
  var key = '.' + (meta.cmd || 'perf') + '|' +
    (meta.id || '') + '|' + (meta.since || '') + '|';
  if (meta.set_cols && meta.set_cols.length) // jshint ignore:line
    key += meta.set_cols.join(','); // jshint ignore:line
  meta.prefix = key;
  if (meta.args && meta.args.length) {
    key += '|' + meta.args.join('_');
  }
  return key;
}

function decodeKey(key) {
  var meta, parts = key.split('|', 5);
  meta = {
    cmd: parts[0].substr(1),
    id: parseInt(parts[1]),
    since: parts[2],
    sets: parts[3],
    set_cols: parts[3].split(',') // jshint ignore:line
  };
  if (parts.length == 5)
    meta.args = parts[4].split('_');
  meta.key = key;
  return meta;
}

function textOrExec(s, args) {
  if (_.isString(s))
    return s;
  return s.call(this, args);
}

// UX
function mediaSize() {
  if (Modernizr.mq('(min-width: 60em)'))
    return "large";
  if (Modernizr.mq('(min-width: 35em)'))
    return "medium";
  return "small";
}

function brightness(rgb) {
  return rgb.r * 0.2125 + rgb.g * 0.7154 + rgb.b * 0.0721;
}

(function($, _, undefined) {

  var defaultFilterCB = $.mobile.filterable.prototype.options.filterCallback,
    supportTouch = $.support.touch,
    touchStartEvent = supportTouch ? "touchstart" : "mousedown",
    touchStopEvent = supportTouch ? "touchend" : "mouseup",
    touchMoveEvent = supportTouch ? "touchmove" : "mousemove";

  // handles swipeup and swipedown
  $.event.special.swipeupdown = {
    setup: function() {
      var thisObject = this;
      var $this = $(thisObject);
      $this.bind(touchStartEvent, function(event) {
        var data = event.originalEvent.touches ?
          event.originalEvent.touches[0] :
          event,
          start = {
            time: (new Date()).getTime(),
            coords: [data.pageX, data.pageY],
            origin: $(event.target)
          },
          stop;

        function moveHandler(event) {
          if (!start) {
            return;
          }
          var data = event.originalEvent.touches ?
            event.originalEvent.touches[0] :
            event;
          stop = {
            time: (new Date()).getTime(),
            coords: [data.pageX, data.pageY]
          };
          // prevent scrolling
          if (Math.abs(start.coords[1] - stop.coords[1]) > 10) {
            event.preventDefault();
          }
        }
        $this
          .bind(touchMoveEvent, moveHandler)
          .one(touchStopEvent, function() {
            $this.unbind(touchMoveEvent, moveHandler);
            if (start && stop) {
              if (stop.time - start.time < 1000 &&
                Math.abs(start.coords[1] - stop.coords[1]) > 30 &&
                Math.abs(start.coords[0] - stop.coords[0]) < 75) {
                start.origin
                  .trigger("swipeupdown")
                  .trigger(start.coords[1] > stop.coords[1] ? "swipeup" : "swipedown");
              }
            }
            start = stop = undefined;
          });
      });
    }
  };

  //Adds the events to the jQuery events special collection
  $.each({
    swipedown: "swipeupdown",
    swipeup: "swipeupdown"
  }, function(event, sourceEvent) {
    $.event.special[event] = {
      setup: function() {
        $(this).bind(sourceEvent, $.noop);
      }
    };
  });

  $.widget("mobile.listview", $.mobile.listview, {
    options: {
      arrowKeyNav: false,
      highlight: false,
      scrollable: null
    },
    _create: function() {
      this._super();
      if (this.options.arrowKeyNav)
        this.arrowKeyNav();
    },
    enhanced: false,
    arrowKeyNav: function() {
      var input = this.element.prev().find("input");

      if (!this.enhanced) {
        this._on(input, {
          "keyup": "handleKeyUp"
        });

        this.enhanced = true;
      }
    },
    handleKeyUp: function(e) {
      var search, active, scroll, orig, curr, diff = 0,
        input = this.element.prev().find("input");

      if (e.which === $.ui.keyCode.DOWN) {
        if (this.element.find("li.ui-btn-active").length === 0) {
          active = this.element.find("li:first")
            .toggleClass("ui-btn-active")
            .find("a")
            .toggleClass("ui-btn-active");
        } else {
          this.element.find("li.ui-btn-active a").toggleClass("ui-btn-active");
          this.element.find("li.ui-btn-active")
            .toggleClass("ui-btn-active").next()
            .toggleClass("ui-btn-active")
            .find("a")
            .toggleClass("ui-btn-active");
        }

        this.highlightDown();
        active = true;
      } else if (e.which === $.ui.keyCode.UP) {
        if (this.element.find("li.ui-btn-active").length !== 0) {
          this.element.find("li.ui-btn-active a").toggleClass("ui-btn-active");
          this.element.find("li.ui-btn-active").toggleClass("ui-btn-active")
            .prev()
            .toggleClass("ui-btn-active")
            .find("a")
            .toggleClass("ui-btn-active");
        } else {
          this.element.find("li:last").toggleClass("ui-btn-active")
            .find("a")
            .toggleClass("ui-btn-active");
        }
        this.highlightUp();
        active = true;
      } else if (typeof e.which !== "undefined") {
        if (e.which === $.ui.keyCode.ENTER)
          this.element.find('li a.ui-btn-active').click();
        this.element.find('li.ui-btn-active').removeClass('ui-btn-active');
        if (this.options.highlight) {
          search = input.val();
          this.element.find("li").each(function() {
            $(this).highlight(search);
          });
        }
      }
      if (active) {
        active = this.element.find('a.ui-btn-active');
        if (!active.length)
          return;
        scroll = $(this.options.scrollable || this.element);
        orig = {
          head: scroll.offset().top,
          toe: scroll.offset().top + scroll.height()
        };
        curr = {
          head: active.offset().top,
          toe: active.offset().top + active.outerHeight()
        };
        if (curr.toe > orig.toe) {
          diff = curr.toe - orig.toe;
        } else if (curr.head < orig.head) {
          diff = curr.head - orig.head;
        }
        if (diff !== 0)
          scroll.scrollTop(Math.round(scroll.scrollTop() + diff));
      }
    },
    highlightDown: function() {
      if (this.element.find("li.ui-btn-active").hasClass("ui-screen-hidden")) {
        this.element.find("li.ui-btn-active").find("a").toggleClass("ui-btn-active");
        this.element.find("li.ui-btn-active")
          .toggleClass("ui-btn-active").next()
          .toggleClass("ui-btn-active").find("a")
          .toggleClass("ui-btn-active");
        this.highlightDown();
      }
      return;
    },
    highlightUp: function() {
      if (this.element.find("li.ui-btn-active").hasClass("ui-screen-hidden")) {
        this.element.find("li.ui-btn-active").find("a").toggleClass("ui-btn-active");
        this.element.find("li.ui-btn-active")
          .toggleClass("ui-btn-active").prev()
          .toggleClass("ui-btn-active").find("a")
          .toggleClass("ui-btn-active");
        this.highlightUp();
      }
      return;
    }
  });

  $.widget('ta.d3filterable', $.mobile.filterable, {
    initSelector: ":jqmData(d3filter='true')",
    options: {
      field: 'name',
      returnFiltered: true,
      hideClass: 'ui-screen-hidden',
      showClass: null,
      filterCallback: function(idx, search, field) {
        var el, text;
        if (!field)
          return defaultFilterCB.call(this, idx, search);
        el = d3.select(this);
        text = el.datum() ?
          el.datum()[field] || el.attr('title') :
          el.attr('title') || el.text();
        return text && text.toLowerCase().indexOf(search) === -1;
      }
    },
    _filterItems: function(val) {
      var idx, callback, length, dst, blanket,
        show = [],
        hide = [],
        opts = this.options,
        filterItems = this._getFilterableItems();

      if (val !== null) {
        callback = opts.filterCallback || defaultFilterCB;

        length = filterItems.length;

        // Partition the items into those to be hidden and those to be shown
        for (idx = 0; idx < length; idx++) {
          if (callback.call(filterItems[idx], idx, val, opts.field))
            dst = hide;
          else
            dst = show;
          dst.push(filterItems[idx]);
        }
      }

      // If nothing is hidden, then the decision whether to hide or show the items
      // is based on the "filterReveal" option.
      if (hide.length === 0) {
        blanket = opts.filterReveal && val.length === 0;
        filterItems.each(function(i, el) {
          el = d3.select(el);
          el.classed(opts.hideClass, blanket);
          if (opts.showClass)
            el.classed(opts.showClass, false);
        });
      } else {
        hide.map(function(el) {
          el = d3.select(el);
          el.classed(opts.hideClass, true);
          if (opts.showClass)
            el.classed(opts.showClass, false);
        });
        show = show.map(function(el) {
          el = d3.select(el);
          el.classed(opts.hideClass, false);
          if (opts.showClass)
            el.classed(opts.showClass, val.length > 1);
          return el.datum();
        });
      }

      //this._refreshChildWidget();
      this._trigger("filter", null, {
        items: opts.returnFiltered ? show : filterItems
      });
    }
  });
}(jQuery, _));

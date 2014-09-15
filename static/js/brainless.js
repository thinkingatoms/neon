// Brainless.js
//
// (c) 2014 Tom Huang
//
(function(root, factory) {
  root.Brainless = factory(root, {}, root._, (root.jQuery || root.$));
}(this, function(root, Brainless, _, $, undefined) {

  /**
   * Base Model
   *
   * supports change/destroy events via update function
   */
  Brainless.Model = function(opt) {
    if (!opt)
      opt = {};
    this.id = _.uniqueId(this.type);
    this.value = opt.value;
    this.changed = {};
  };
  $.extend(Brainless.Model.prototype, {
    type: 'Model',
    keyField: 'key',
    key: function() {
      return this.value && this.value[this.keyField];
    },
    get: function(key) {
      return this.value && this.value[key];
    },
    set: function(key, value) {
      var change;
      if (key === this) {
        change = value;
      } else {
        change = {};
        change[key] = value;
      }
      this.update(change);
    },
    update: function(obj, opt) {
      var that = this;
      if (opt && opt.queue) {
        $(this).queue(function() {
          that._update(obj, opt);
          $(this).dequeue();
        });
      } else {
        that._update(obj, opt);
      }
    },
    _update: function(obj, opt) {
      var changed,
        ev = opt && opt.ev,
        el = $(this),
        force = opt && opt.force,
        value = this.value;
      if (value === undefined) {
        if (obj) {
          changed = this.value = obj;
          el.trigger(ev || 'insert');
        }
      } else if (obj === undefined) {
        if (force) {
          changed = null;
          el.trigger(ev || 'delete');
          delete this.value;
          delete this.changed;
        }
      } else {
        changed = {};
        _.each(obj, function(v, k) {
          if (v === undefined && !force)
            return;
          if (value[k] !== v)
            changed[k] = value[k] = v;
        });
        if ($.isEmptyObject(changed)) {
          changed = undefined;
        } else {
          changed = $.extend(this.changed || {}, changed);
        }
      }
      if (changed !== undefined)
        $(this).trigger(ev || 'update', changed);
      return changed;
    }
  });

  Brainless.Collection = function(opt) {
    Brainless.Model.call(this, opt);
    this.cls = opt && opt.cls || Brainless.Model;
    this.values = {};
  };
  Brainless.Collection.subclass(Brainless.Model, {
    iud: function(key, value) {
      if (value === undefined)
        this.remove(key);
      else if (!this.values[key])
        this.add(value, key);
      else
        this.values[key].update(value);
    },
    add: function(value, key) {
      if (!key)
        key = value.key();
      this.values[key] = value;
      $(this).trigger('insert', value);
    },
    remove: function(key) {
      var value = this.values[key];
      delete this.values[key];
      if (value)
        $(this).trigger('delete', value);
    }
  });

  /**
   * Get a glorified plain object with jQuery widget attached
   * leveraging jQuery events/widget system for controller OOP + interaction
   *
   * see 'Base Controller' widget below for more details.
   */
  Brainless.controller = function(name, parent, el, opt) {
    var ctrl = el || {};
    if (!opt)
      opt = {};
    if (parent && parent.children[name])
      return parent.children[name];
    if (!$(ctrl)[name])
      return null;
    ctrl.parent = parent;
    if (!ctrl.children)
      ctrl.children = {};
    $(ctrl)[name](opt);
    if (parent) {
      parent.children[name] = ctrl;
    }
    return ctrl;
  };


  /**
   * Template Services
   *
   * leveraging jQuery's queue system to execute tasks
   */


  /**
   * Base Controller
   *
   * there are two types of controllers:
   * abstract - controller element is a jQuery-wrapped plain object
   * viewmodel - controller element is a jQuery DOM element
   *
   *
   * top level controllers without a parent are "applications"
   * sub-controllers can listen to or trigger its parent/app's events
   *
   * sub-controllers may inherit a portion of parent's state to manage
   * sub-controllers inherit bounded view/text functions from the app
   *
   * "resize" and "lights" (on/off) are two examples of global events
   */
  $.widget('brainless.controller', {
    options: {
      stateKey: '',
    },
    _create: function() {
      var el = this.elem = this.element[0],
        stateKey = this.options.stateKey,
        parent = this._parent(),
        app = this._app();
      // inherit a portion of parent's state to manage
      if (stateKey && parent && parent.state) {
        this.elem.state = new Brainless.Model({
          value: (parent === app ?
            parent.state[stateKey] :
            parent.state.value[stateKey])
        });
        $(this.elem.state).on('change', function() {
          $(app).app('save');
        });
      }
      // inherit bounded view/text retrieval functions from the app
      if (parent) {
        el.view = parent.view;
        el.text = parent.text;
      }
      // auto subscribe applicable "resize" "lights" events
      if (this._resize !== $.noop) {
        this.resize = this.resize || _.bind(this._resize, this);
        if (el !== parent)
          $(parent).on('resize', this.resize);
      }
      if (this._lights !== $.noop) {
        this.lights = this.lights || _.bind(this._lights, this);
        if (el !== parent)
          $(parent).on('lights', this.lights);
      }
    },
    _resize: $.noop,
    _lights: $.noop,
    _app: function() {
      var el = this.elem;
      while (el.parent)
        el = el.parent;
      return el;
    },
    _parent: function() {
      return this.elem.parent;
    }
  });

  /**
   * Base Single-Page WebSocket Application
   *
   * handles:
   *  - restarts
   *  - simple storage/state management
   *
   * app controller is a bit special since we are directly
   * touching the underlying object to add the following keys:
   *
   * socket - WebSocket connection
   * log - Application Logging
   * view - function to get DOM elements
   * text - function to get predefined strings
   * state - Application State
   */
  $.widget('brainless.app', $.brainless.controller, {
    options: {
      url: '',
      socket: '',
      version: 0.1,
      restartLocation: '',
      storageKey: 'gameState',
      mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),
      dragging: false,
      typing: false,
      screenX: 0,
      screenY: 0,
      views: null,
      size: null
    },
    _create: function() {
      var el;
      this._super();
      el = this.elem; // === this.element[0]
      el.log = this.options.debug ? function(msg) {
        console.log(arguments.length > 1 ? arguments : msg);
      } : $.noop;
      el.state = null;
      el.socket = null;
      el.view = _.bind(this._getView, this);
      el.text = _.bind(this._getText, this);

      this.local = undefined;
      this.lastSave = undefined;
      this.initialized = false;
      this.elems = {};
      this.save = _.bind(this._save, this);
    },
    setup: function() {
      var el = this.elem;
      el.socket = io.connect(this.options.socket);
      el.socket.on('init', _.bind(this._load, this));
      this._load(this.options.state);
    },
    teardown: function() {
      this._save(true);
      this.elem.socket.disconnect();
    },
    save: $.noop,
    restart: function() {
      this.state = {};
      localStorage.removeItem(this.options.storageKey);
      window.location = this.options.restartLocation;
    },
    _save: function(force) {
      var el = this.elem,
        now = Date.now();
      if (force || !this.lastSave || now - this.lastSave > 120000) {
        this.lastSave = now;
        if (this.local && el.state && Modernizr.localstorage)
          localStorage.setItem(this.options.storageKey, JSON.stringify(el.state));
      }
    },
    _load: function(state) {
      var el = this.elem;
      if (state) {
        if (_.isString(state)) {
          // state is a server key
          el.socket.emit('state', state);
          return;
        } else {
          this.local = false;
        }
      } else {
        this.local = true;
        try {
          state = JSON.parse(localStorage.getItem(this.options.storageKey));
        } catch (e) {
          state = {};
        }
      }
      if (this.initialized)
        this._destroy();
      this._update(state);
      this._resize();
      this._build();
      this._lights();
      this.initialized = true;
    },
    _update: function(state) {
      this.elem.state = state;
    },
    _build: $.noop,
    _getView: function(keys) {
      /**
       * Get (cached) jQuery DOM elements
       *
       * @param {Array|String} keys - one key or list of keys
       * @param {String} prefix - prefix/namespace used to distinguish objects
       *
       * keys can be array or a single selector
       * if array: return a hash of DOM elements
       * if single key: return specified element
       *
       * nonexistent keys will return undefined
       * missing values will return null
       *
       * TODO: smarter parent element
       */
      var key, el, views = this.options.views;
      if (!views)
        return;
      if (_.isString(keys)) {
        key = keys;
        if (!views[key])
          return;
        el = this.elems[key];
        if (!el) {
          el = $(views[key]);
          if (!el.length)
            el = null;
          else
            this.elems[keys] = el;
        }
        return el;
      }
      el = {};
      for (key in keys) {
        key = keys[key];
        el[key] = this._getView(key);
      }
      return el;
    },
    _getText: function(keys) {
      var key, results, texts = this.options.texts;
      if (!texts)
        return;
      if (_.isString(keys)) {
        return texts[keys];
      }
      results = {};
      for (key in keys) {
        key = keys[key];
        results[key] = texts[key];
      }
      return results;
    }
  });

  /**
   * Base Server
   */
  $.widget('brainless.server', {
    options: {
      background: true,
      loopWait: 120000, // run every 2 minutes
      wait: 500,
      queue: 'brainless'
    },
    _create: function() {
      this.DONE = {};
      this.elem = this.element[0];

      this.serving = false;
      this.tasks = {};
      this.count = 0;

      this.serve = _.bind(this._serve, this);
      this.serveLater = _.bind(function() {
        setTimeout(this.serve, this.options.loopWait);
      }, this);
      this.enqueue = _.bind(this._enqueue, this);
      this.dequeue = _.bind(function() {
        this.element.dequeue(this.options.queue);
      }, this);
      this.run = _.bind(this._run, this);
    },
    _destroy: function() {
      this.element.off();
      this.serving = false;
      this.tasks = {};
      this.count = 0;
    },
    // public
    start: function() {
      this.serving = true;
      this.serve();
    },
    stop: function() {
      this.serving = false;
    },
    serve: null,
    serveLater: null,
    enqueue: null,
    dequeue: null,
    run: null,
    // private
    _serve: function() {
      var tasks;
      if (this.serving) {
        tasks = this._canRun();
        if (!_.isEmpty(tasks)) {
          _.each(tasks, this.enqueue);
          this.enqueue(this.DONE);
        }
      }
      if (this.options.background)
        this.element.queue(this.serveLater);
      this.dequeue();
    },
    _enqueue: function(task, key) {
      this.element.queue(this.options.queue, _.bind(function() {
        if (task === this.DONE) {
          this._trigger('done');
        } else {
          this._run(task, key);
        }
        if (this.options.wait) {
          setTimeout(this.dequeue, this.options.wait);
        } else {
          this.dequeue();
        }
      }, this));
    },
    _canRun: function() {
      return this.tasks;
    },
    _run: $.noop
  });

  return Brainless;
}));

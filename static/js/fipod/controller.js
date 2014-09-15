(function(Brainless, $, _, undefined) {

  var models = Brainless.thinkingatoms;

  /**
   * FiPod application
   *
   * In addition to standard "app", there are:
   *
   * 1. added more global handlers in setup, _resize, _lights, mail
   * 2. extended _update to ensure state is up to date
   * 3. implemented _build function
   *
   */
  $.widget('thinkingatoms.app', $.brainless.app, {
    setup: function() {
      var views, opt = this.options;
      this._super();

      views = this.elem.view(['win', 'lightButtons', 'menuButton', 'help',
        'contactform', 'restart', 'soon', 'reset'
      ]);
      views.win.resize(_.debounce(_.bind(this._resize, this), 500));
      views.lightButtons.click(_.bind(this._lights, this));
      views.contactform.submit(_.bind(this.mail, this));
      views.restart.click(_.bind(this.restart, this));
      views.reset.popup();
      views.soon.panel({
        open: function() {
          $('.ui-collapsible:first', views.soon).collapsible('expand');
        }
      });
      $('.ta-side-panel h3, #disclaimer, #about').click(function() {
        $('.ui-panel-open').panel('close');
      });
      $(':text, input[type=email], textarea, #search').on('focus', function() {
        opt.typing = true;
      }).on('blur', function() {
        opt.typing = false;
      });
    },
    _update: function(state) {
      var i, version, categories = ['game', 'metas', 'tutorial', 'graph'];
      if (!state || !state.game || !state.game.version)
        state = {};
      for (i in categories) {
        i = categories[i];
        if (!state[i])
          state[i] = {};
      }
      if (!state.metas.map)
        state.metas.map = {};
      version = state.game.version || 0;
      if (typeof version != 'number')
        version = 0;
      if (version < 1.2) {
        delete state.stats;
        delete state.vital;
        state.tutorial = {
          seen: {}
        };
      } else if (version < 1.3 && state.tutorial && state.tutorial.seen) {
        state.tutorial.seen = {};
      }
      if (this.options.version > version) {
        delete state.game.init;
        state.game.version = this.options.version;
      }
      this._super(state);
    },
    _resize: function(ev) {
      var height, size, views, opt = this.options;
      if (opt.typing)
        return;
      size = mediaSize();
      views = this.elem.view(['win', 'main', 'screen', 'wheel',
        'header', 'headerButtons'
      ]);
      opt.screenX = views.win.width();
      opt.screenY = views.win.height() - views.header.outerHeight();
      if (!opt.screenY)
        return;
      views.main.css('height', opt.screenY);
      if (size === 'small') {
        views.screen.css('margin', '0.25em auto 0');
        views.wheel.css('margin', 'auto');
      } else {
        height = Math.floor(opt.screenY * 0.025) + 'px auto';
        views.screen.css('margin', height);
        views.wheel.css('margin', height);
      }
      if (size !== opt.size) {
        opt.size = size;
        if (size === 'large') {
          views.headerButtons.removeClass('ui-btn-icon-right')
            .addClass('ui-btn-icon-top')
            .removeClass('ui-btn-icon-notext');
        } else {
          views.headerButtons.addClass('ui-btn-icon-notext')
            .addClass('ui-btn-icon-right')
            .removeClass('ui-btn-icon-top');
        }
      } else {
        size = null;
      }
      if (ev) {
        this.element.trigger('resize', size);
      }
    },
    _build: function() {
      var el = this.elem;
      Brainless.controller('welcome', el);
      Brainless.controller('help', el, el.view('help')[0], {
        transition: Modernizr.touch ? 'none' : 'pop'
      });
      el.socket.emit('levels', function(headlines, levels) {
        el.headlines = headlines;
        el.levels = levels;
        Brainless.controller('fipod', el);
      });
      Brainless.controller('quoter', null, el);
      Brainless.controller('munger', null, el);
    },
    _lights: function(toggle) {
      var text, on,
        el = this.elem,
        game = el.state.game,
        views = el.view(['page', 'body', 'lightButtons', 'lightIcons']),
        isOn = views.page.hasClass('ui-page-theme-a');
      if (game.lights === undefined)
        game.lights = true;
      on = game.lights;
      if (toggle) {
        on = game.lights = !on;
        this.element.trigger('lights', on);
        if (toggle !== true)
          toggle.stopPropagation();
      }
      if (isOn ^ on) {
        if (isOn) {
          views.body.addClass('ui-overlay-b').removeClass('ui-overlay-a');
        } else {
          views.body.addClass('ui-overlay-a').removeClass('ui-overlay-b');
        }
        views.page.toggleClass('ui-page-theme-a')
          .toggleClass('ui-page-theme-b');
        views.lightIcons.toggleClass('ui-alt-icon');
      }
      text = on ? 'Lights Off' : 'Lights On';
      views.lightButtons.removeClass('ui-btn-active').text(text);
    },
    mail: function(ev) {
      var i, v,
        el = this.elem,
        sent = false,
        subject = '',
        msg = '',
        contact = el.view('contact'),
        invalid = $('.ta-invalid', contact),
        fields = ['#email', '#subject', '#message'];
      ev.preventDefault();
      for (i in fields) {
        v = $(fields[i]).val();
        if (v === '') {
          invalid.text('please specify ' + fields[i].substr(1)).slideDown();
          return;
        }
        if (fields[i] === '#subject')
          subject = v;
        msg += v + '\n';
      }
      try {
        msg += '\n### STATE ###\n' + JSON.stringify(el.state);
      } catch (e) {
        msg += '\n### INVALID STATE ###\n';
      }
      $.mobile.loading('show');
      el.socket.emit('contact', subject, msg, function(verified) {
        var i;
        if (verified) {
          sent = true;
          $.mobile.loading('hide');
          contact.panel('close');
          this.element.trigger('help', 'contact');
          for (i in fields)
            $(fields[i]).val('');
          invalid.slideUp();
          return;
        }
        failed();
      });

      setTimeout(function() {
        if (!sent)
          failed();
      }, 10000);

      function failed() {
        $.mobile.loading('hide');
        invalid.text([
          'apologies, we could not send your message, ',
          'please email '
        ].join(''));
        $(
          ['<a href="mailto:atom@thinkingatoms.com">',
            'atom@thinkingatoms.com</a>'
          ].join(''))
          .appendTo(invalid);
        invalid.slideDown();
      }
    }
  });

  $.widget('thinkingatoms.fipod', $.brainless.controller, {
    _create: function() {
      this._super();

      this._buildComponents();

      this._setupSearch();

      this._addEvents();
    },
    _buildComponents: function() {
      var el = this.elem,
        app = this._app(),
        views = app.view(['wheel', 'lines', 'tooltip',
          'legend', 'settings', 'search', 'searchResults'
        ]),
        filterable = {
          input: '#search',
          hideClass: 'ta-filtered',
          showClass: 'ta-filtered-in'
        };

      this.legend = views.legend.d3filterable(filterable);
      Brainless.controller('legend', el, views.legend[0]);

      this.tooltip = views.tooltip;
      Brainless.controller('tooltip', el, views.tooltip[0]);

      filterable = _.clone(filterable);
      filterable.children = 'g.texts > text, g.paths > path';
      this.wheel = views.wheel.d3filterable(filterable);
      Brainless.controller('moonburst', el, views.wheel[0]);

      filterable = _.clone(filterable);
      filterable.children = 'g.lines > path, g.dots > circle';
      this.lines = views.lines.d3filterable(filterable);
      Brainless.controller('xyzbubbles', el, views.lines[0]);

      this.settings = views.settings;
      Brainless.controller('settings', el, views.settings[0]);
    },
    _setupSearch: function() {
      var that = this,
        app = this._app(),
        views = this.elem.view(['search', 'searchResults']);
      views.search.on('keyup', function(e) {
        var el = $(this);
        switch (e.which || e.keyCode) {
          case 27: // Esc
            setTimeout(function() {
              el.val('');
              $('li', views.searchResults).remove();
            }, 0);
            break;
          default:
            break;
        }
        var v = el.val();
        if (v == that.lastSearch)
          return;
        that.lastSearch = v;
        if (v === '') {
          $('li', views.searchResults).remove();
        } else {
          app.socket.emit('search', v, that.search);
        }
      });
      views.searchResults.listview({
        arrowKeyNav: true
      });
    },
    _addEvents: function() {
      var that = this,
        app = this._app();
      this.minimize = _.bind(this._minimize, this);
      this.wheel.on('swipedown', this.minimize);
      this.lines.on('swipedown', this.minimize);
      this.tooltip.on('click', function() {
        that.legend.legend('toggle');
      });
      this.prepWheel = _.bind(this._prepWheel, this);
      $(app).munger('onPerf', 'refresh', _.debounce(function(ev, args) {
        that.refreshWheel(args);
      }, 500));
      $(app).munger('onTS', 'refresh', _.debounce(function(ev, args) {
        that.refreshLines(args);
      }, 500));
    },
    /**
     *
     * Below are all events handled by FiPod
     *
     */
    _minimize: function() {
      if (this.isMini)
        return;
      this.toggleMini();
    },
    toggleMini: function() {
      this.isMini = !this.isMini;
      this.elem.view('main').toggleClass('ta-mini');
      this.element.trigger('resize');
      if (this.isMini)
        $(this._app()).help('show', 'mini');
    },
    configure: function(meta) {
      this.meta = _.clone(meta);
      this.settings.settings('prepare', meta);
    },
    refreshWheel: function(args) {
      this.wheel.moonburst('prepare', args.meta, args.data);
    },
    refreshLines: function(args) {
      var app = this._app();
      this.lines.xyzbubbles('prepare', args);
      if (args) {
        this.lines = args.lines;
        if ($(app).app('option', 'typing'))
          this.lines.d3filterable('refresh');
        this.legend.legend('prepare', args);
      }
    },
    refreshLegend: function(current) {
      this.legend.legend('setActive', current);
    },
    showCurrent: function(current) {
      this.tooltip.tooltip('draw', current);
      if (current.source === 'lines ')
        this.refreshLegend(current);
      else if (current.source === 'legend ')
        this.lines.xyzbubbles('setActive ', current);
    },
    clicked: function(args) {
      //  interact with munger server to change Meta models
      var i, orig, curr, ts, detail, parts,
        app = this._app(),
        d = args.data,
        clickType = args.type;
      orig = this.meta;
      if (d.id <= 0) {
        if (d.origChildren !== undefined && clickType == 'double') {
          $(app).munger('leaveDetail', d);
          return;
        }
        detail = d.origChildren === undefined && (
          clickType === 'double' || !d.children);
      } else {
        detail = false;
      }
      curr = {};
      curr.since = orig.since;
      curr.ret_type = orig.ret_type;
      curr.set_cols = [];
      if (d.id <= 0) {
        curr.cmd = 'ts';
        curr.id = orig.id;
        curr.args = [d.i.toString()];
        if (orig.id != d.i) {
          parts = d.i.toString().split(',');
          i = 0;
          while (curr.set_cols.length < parts.length)
            curr.set_cols.push(orig.set_cols[i++]);
        }
      } else {
        curr.cmd = 'tssec';
        curr.id = -1;
        curr.args = [d.id.toString()];
        curr.name = d.name;
      }
      ts = !this.lines[encodeMeta(curr)];
      if (ts) {
        $(app).munger('joinTS', curr);
        if (clickType !== 'double' || d.parent)
          if (clickType !== 'back' && d.parent && d.id <= 0)
            $(app).help('show', 'zoomed');
          else
            $(app).help('show', 'legend');
      }
      if (detail) {
        d.origChildren = d.children || 0;
        detail = $.extend({}, curr, {
          cmd: 'detail',
          parent: orig.key
        });
        $(app).munger('joinDetail', detail);
      }
    }
  });

  $.widget('thinkingatoms.welcome', $.brainless.controller, {
    options: {
      stateKey: 'game'
    },
    _create: function() {
      var el, views, welcoming;

      this._super();

      el = this.elem;
      views = el.view(['welcome', 'homeButtons']);
      welcoming = (views.welcome.css('display') !== 'none');
      if (!el.state.get('init')) {
        if (!welcoming)
          this._arrive(true);
      } else if (welcoming) {
        this._depart();
      }

      this.toggle = this.toggle || _.bind(this._toggle, this);
      views.homeButtons.click(this.toggle);

      Brainless.controller('manual', el, views.welcome[0]);
    },
    _toggle: function() {
      var el = this.elem,
        welcoming = (el.view('welcome').css('display') !== 'none');
      if (!el.state.get('init')) {
        el.state.set('init', true);
      }
      if (welcoming)
        this._depart();
      else
        this._arrive();
    },
    _depart: function() {
      var that = this,
        app = this._app(),
        views = app.view(['page', 'welcome', 'fipod',
          'title', 'menuHomeButton'
        ]);
      views.page.removeClass('ta-welcoming');
      views.welcome.fadeOut(function() {
        views.fipod.fadeIn(function() {
          views.title.text(app.text('fipod_title'));
          views.menuHomeButton.text(app.text('fipod_menuHomeButton'));
          $(app).trigger('resize', $(app).app('option', 'size'));
          that.element.trigger('depart');
        });
      });
    },
    _arrive: function(init) {
      var that = this,
        app = this._app(),
        views = app.view(['fipod', 'page', 'welcome',
          'title', 'menuHomeButton'
        ]);
      views.fipod.css('display', 'none');
      views.page.addClass('ta-welcoming');
      if (init) {
        views.welcome.css('display', 'block').css('opacity', 1);
        that.element.trigger('resize', $(app).app('option', 'size'));
      } else {
        views.welcome.fadeIn(function() {
          views.title.text(app.text('welcome_text'));
          views.menuHomeButton.text(app.text('welcome_menuHomeButton'));
          that.element.trigger('resize', $(app).app('option', 'size'));
        });
      }
    },
  });

  $.widget('thinkingatoms.help', $.brainless.controller, {
    options: {
      stateKey: 'tutorial'
    },
    _create: function() {
      var app, el, views, that = this;
      this._super();
      this.activeKey = null;
      this.tips = new models.HelpTips(this);
      this.element.on('click', function() {
        that.close();
      });

      el = this.elem;
      app = this._app();
      views = el.view(['helpButtons', 'settings', 'menu']);
      if (el.state.on)
        $('.ta-btn-start:not(.ta-welcome)').addClass('ui-btn-active');

      this.element.helptip({
        transition: Modernizr.touch ? 'none' : 'pop'
      });
      views.helpButtons.click(function(ev) {
        var toggleWelcome = false;
        ev.preventDefault();
        if ($(this).hasClass('ta-welcome')) {
          this.state.on = false;
          toggleWelcome = true;
        }
        this.state.on = !this.state.on;
        this.tips.resetImportant();
        if (this.state.on) {
          views.settings.parent().collapsible('collapse');
          views.menu.panel('close');
          $('.ta-btn-start:not(.ta-welcome)').addClass('ui-btn-active');
        } else {
          $(el).help('close');
          $('.ta-btn-start:not(.ta-welcome)').removeClass('ui-btn-active');
        }
        if (toggleWelcome)
          $(app.children.welcome).welcome('toggle');
      });

    },
    close: function() {
      var s, keep, that = this;
      keep = $('#keepPopup', this.element);
      if (this.activeKey && keep.length &&
        keep.hasClass('ui-checkbox-on')) {
        this.elem.state.seen[this.activeKey] = true;
      }
      if (this.activeKey === 'init')
        this.elem.state.init = true;
      this.element.helptip('close');
      this.isOpen = false;
      s = this.tips.values[this.activeKey];
      this.activeKey = null;
      if (s && s.next && s.immediate) {
        setTimeout(function() {
          that.show(s.next);
        }, 300);
      }
    },
    show: function(key) {
      var tip,
        el = this.elem,
        app = this._app();
      if (!el.state.on || (key !== 'init' && !el.state.init))
        return;
      if (app.view('page').hasClass('ta-welcoming'))
        return;
      tip = this.tips.getUnseen(key);
      if (!tip)
        return;
      this.element.helptip('draw', this.tips.build(tip));
    },
  });

}(Brainless, jQuery, _));

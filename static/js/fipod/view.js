(function(Brainless, $, _, undefined) {

  function getWindowCoordinates(theWindow) { // jshint ignore:line
    return {
      x: theWindow.scrollLeft(),
      y: theWindow.scrollTop(),
      cx: (theWindow[0].innerWidth || theWindow.width()),
      cy: (theWindow[0].innerHeight || theWindow.height())
    };
  }

  $.widget('thinkingatoms.ui', $.brainless.controller, {
    _create: function() {
      var that = this;
      this._super();

      // tooltip
      if (this._tooltipContent !== $.noop) {
        this.showTooltip = function(d) {
          var el, at = that.app.dragging;
          if (at) {
            el = document.elementFromPoint(at.x, at.y);
            if (el.tagName === 'tspan')
              el = el.parentNode;
            el = d3.select(el);
            d = el.datum();
            if (!d || $.isNumeric(d))
              return;
          } else {
            el = d3.select(this);
          }
          if (el.classed('ta-filtered') || !d)
            return;
          d = that._tooltipContent(d);
          that.fire('showTip', d);
        };
        this.activateTooltip = function(el) {
          el.on('mouseenter', that.showTooltip);
        };
      } else {
        this.activateTooltip = this.showTooltip = $.noop;
      }
    },
    _queuedResize: function(ev, size) {
      var that = this;
      this.element.queue(function() {
        if (that.g)
          that.g.attr('transform', function(d) {
            d.x = that.options.shiftX || 0;
            d.y = that.options.shiftY || 0;
            return 'translate(' + d.x + ',' + d.y + ')';
          });
        that.__resize(ev, size);
        that.element.dequeue();
      });
    },
    __resize: $.noop,
    _queuedLights: function(isOn) {
      var that = this;
      this.element.queue(function() {
        that.__lights(isOn);
        that.element.dequeue();
      });
    },
    __lights: $.noop,
    _tooltipContent: $.noop,
    _destroy: $.noop
  });

  $.widget('thinkingatoms.manual', $.thinkingatoms.ui, {
    _create: function() {
      this._resize = this._queuedResize;
      this._super();
      this.duration = 1000;
      this.intro = $('.ui-block-a', this.element);
      this.diagram = $('.ui-block-b', this.element);
      this.welcome = this.elem.view('welcome');
      this.page = this.elem.view('page');
      this.initialized = false;
    },
    __resize: function(ev, size) {
      var that = this,
        parent = this._parent();
      if (!parent.state.get('init'))
        return;
      if (this.welcome.css('display') === 'none')
        return;
      if (!this.initialized) {
        if (size === 'small')
          this.intro.slideUp(this.duration, show);
        else
          this.intro.animate({
            width: 0,
            opacity: 0
          }, this.duration, show);
        this.welcome.addClass('ta-manual');
        this.initialized = true;
      } else {
        show();
      }

      function show() {
        // FIXME: move more to css
        var g, w, isSmall, intro = that.intro,
          diagram = that.diagram,
          margin = '0 0 1em';
        if (that.welcome.css('display') === 'none')
          return;
        intro.css('display', 'none');
        diagram.css('width', '100%');
        w = diagram.outerWidth();
        isSmall = Modernizr.touch && that.app.size;
        isSmall = isSmall && !Modernizr.mq('(min-width: 30em)');
        if (isSmall) {
          g = d3.select(that.element[0]).select('svg')
            .style('margin', margin)
            .transition().duration(that.duration)
            .attr('viewBox', '0 0 527 1000')
            .style('width', '17em')
            .style('max-width', '100%')
            .select('g').transition()
            .attr('transform', 'rotate(-90)translate(-1000,0)').selectAll('g');
        } else {
          if (size === 'large') {
            margin = '0 10% 1em';
            w *= 0.8;
            w = Math.round(w);
          }
          g = d3.select(that.element[0]).select('svg')
            .style('max-width', '50em').style('margin', margin)
            .transition().duration(that.duration)
            .attr('viewBox', '0 0 1000 527').style('width', w + 'px')
            .select('g').transition().attr('transform', '').selectAll('g');
        }
        g.style('visibility', 'visible');
      }
    }
  });

  $.widget('thinkingatoms.settings', $.thinkingatoms.ui, {
    _create: function() {
      var views, app, that = this;

      this._super();
      app = this._app();
      views = app.view(['menu', 'menuButton', 'page', 'settingButtons', 'help']);

      this.key = this.meta = null;
      this.initialized = false;
      this.sincelinked = false;
      this.count = 0;
      this.cache = {};
      this.breakdown = [];
      this.refresh = _.bind(this._refresh, this);

      views.menu.panel({
        open: function() {
          that.isOpen = true;
          $(app).trigger('help', 'settings');
        },
        close: function() {
          that.isOpen = false;
        }
      });

      views.menuButton.on('click', function() {
        views.menu.panel('open');
      }).on('mouseenter', function() {
        if (views.page.hasClass('ta-welcoming') ||
          $(app).app('option', 'size') === 'small' ||
          views.help.parent().hasClass('ui-popup-active'))
          return;
        views.menu.panel('open');
      });

      views.settingButtons.click(function() {
        views.menu.panel('open');
        setTimeout(function() {
          that.element.parent().collapsible('expand');
        }, 500);
      });

      that.element.parent().collapsible()
        .on('collapsibleexpand', function() {
          that.isCollapsed = false;
          $(app).trigger('help', 'bench');
        }).on('collapsiblecollapse', function() {
          that.isCollapsed = true;
        });
    },
    prepare: function(meta) {
      var that = this,
        key = encodeMeta(meta);
      if (key !== this.key || meta.ret_type !== this.meta.ret_type) {
        this.element.queue(function() {
          that.key = key;
          that.meta = meta;
          that.draw();
          that.element.dequeue();
        });
      }
    },
    draw: function() {
      var i, h, bd, bds, rt,
        that = this,
        app = this._app();
      if (!this.initialized) {
        this._drawHeadline();
        this._drawHeadlines();
        this._drawBreakdowns();
        this._drawSince();
        $('#ret-type', this.element).click(function() {
          $(this).toggleClass('ui-checkbox-off').toggleClass('ui-checkbox-on');
        });
        $('#build').click(this.refresh);
        this.initialized = true;
      }
      h = _.find(app.headlines, function(d) {
        return d.id == that.meta.id;
      });
      $('#headline').attr('data-pid', h.id).text(h.text);
      $('#headlines').css('display', 'none');
      bd = this.meta.set_cols.slice(0);
      bds = $('#breakdowns', this.element);
      for (i in bd) {
        bds.val(bd.slice(0, i + 1));
        bds.trigger('change', true);
      }
      $('#since').val(this._getSinceIndex(this.meta)).selectmenu('refresh');
      rt = $('#ret-type', this.element);
      if (this.meta.ret_type === 'gross' ^ rt.hasClass('ui-checkbox-on'))
        rt.trigger('click');
      this.sincelinked = false;
    },
    _refresh: function(ev) {
      var v, meta = {}, app = this._app();
      if (ev) {
        meta.cmd = 'perf';
        meta.id = parseInt($('#headline').attr('data-pid'));
        if (isNaN(meta.id))
          return;
        meta.set_cols = [];
        $('#breakdown > li', this.element).each(function(i, d) {
          meta.set_cols.push($(d).attr('id')
            .replace('bkdw', '')
            .replace('_', ':'));
        });
        if (!meta.set_cols.length)
          return;
        if ($('#ret-type', this.element).hasClass('ui-checkbox-on'))
          meta.ret_type = 'gross';
        else
          meta.ret_type = 'price';
      } else {
        // sincelinked
        meta = $.extend({}, this.meta);
      }
      v = $('#since').val();
      switch (v) {
        case '-1':
        case '':
        case 0:
        case undefined:
        case null:
          meta.since = '';
          break;
        default:
          meta.since = v;
          break;
      }
      app.view('menu').panel('close');
      app.log('joining', encodeMeta(meta), meta);
      $(app).trigger('joinPerf', meta);
    },
    _validate: function() {
      var that = this,
        done = $('#build', that.element);
      if (that.count > 0 && that.count <= 3 && $('#headline').text()) {
        done.addClass('ui-icon-carat-r ui-btn-active')
          .removeClass('ui-icon-forbidden ui-state-disabled');
      } else {
        done.removeClass('ui-icon-carat-r ui-btn-active')
          .addClass('ui-icon-forbidden ui-state-disabled');
      }
    },
    _drawHeadline: function() {
      var that = this,
        el = that.element,
        headline = $('#headline', el),
        headlines = $('#headlines ul', el);
      headline.click(function() {
        if (headline.text())
          headline.slideDown();
        if (!headline.hasClass('ui-icon-gear')) {
          headline.addClass('ui-icon-gear');
          headlines.parent().slideUp(function() {
            //that.refresh();
            that.pub('Help', 'show', null, 'levels');
          });
          return;
        }
        headline.removeClass('ui-icon-gear');
        headlines.parent().slideDown(); //that.refresh);
      });
      if (!headline.text())
        headline.css('display', 'none');
    },
    _drawHeadlines: function() {
      var template, that = this,
        el = that.element,
        main = that.elem.parent,
        headline = $('#headline', el),
        headlines = $('#headlines ul', el);
      $('li', headlines).remove();
      template = _.template(['<li data-filtertext="<%= filtertext %>">',
        '<a href="#" data-pid="<%= id %>"><%= text %></a></li>'
      ].join(''));
      el = _.chain(main.headlines).sortBy(function(d) {
        return d.text;
      }).map(function(d) {
        var ft, that = that;
        if (!d.filtertext) {
          ft = d.text.replace('(', '').replace(')', '');
          if (ft.contains('00'))
            ft += ' SP S&P SNP';
          if (ft.contains('500'))
            ft += ' RUS';
          d.filtertext = ft;
        }
        return template(d);
      }).reduce(function(items, item) {
        items += item;
        return items;
      }, '').value();
      $(el).appendTo(headlines);
      $('li > a', headlines).click(function() {
        var h = $(this);
        h.removeClass('ui-btn-active');
        headline.attr('data-pid', h.attr('data-pid')).text(h.text())
          .addClass('ui-icon-gear')
          .slideDown(); // that.refresh);
        headlines.parent().slideUp(function() {
          //that.refresh();
          that.pub('Help', 'show', null, 'levels');
        });
        that._validate();
      });
      headlines.listview();
    },
    _drawBreakdowns: function() {
      var that = this,
        el = that.element,
        main = that.elem.parent,
        cache = that.cache,
        bd = $('#breakdown', el),
        bds = $('#breakdowns', el);

      $('optgroup', bds).remove();
      el = _.chain(main.levels).map(function(d) {
        var opts = _.map(d.children, function(c) {
          cache[c.id] = c.text;
          return '<option value="' + c.id + '" title="' + c.text + '">' +
            c.text + '</option>';
        }).join('');
        return '<optgroup label="' + d.text + '">' + opts + '</optgroup>';
      }).reduce(function(items, item) {
        items += item;
        return items;
      }).value();
      $(el).appendTo(bds);
      bds.change(_.bind(that._breakdownChanged, that, bds));
      bd.listview().sortable().disableSelection();
      bds.selectmenu('refresh');
      // brkdwnButton = $('#breakdowns-button', nav);
    },
    _breakdownChanged: function(ev, init) {
      var i,
        bds = $('#breakdowns', this.element),
        sel = bds.val(),
        curr = this.breakdown;
      if (!sel)
        sel = [];
      for (i in curr) {
        i = curr[i];
        if (sel.indexOf(i) < 0)
          this._remove(i, ev);
      }
      for (i in sel) {
        i = sel[i];
        if (curr.indexOf(i) < 0)
          this._add(i, ev);
      }
      if (init)
        return;
      if (this.isCollapsed && !this.sincelinked) {
        if (!this.isOpen)
          this.elem.view('menu').panel('open');
        else if (this.count > 0)
          $(this.elem.parent).trigger('help', 'levelsort');
      }
    },
    _add: function(id, ev) {
      var text, i = 'bkdw' + id.replace(':', '_'),
        bd = $('#breakdown', this.element),
        el = $('#' + i, bd),
        that = this;
      if (el.length)
        return;
      el = $('<li>').attr('id', i);
      text = $('<a href="#">').text(that.cache[id]).appendTo(el);
      $('<a href="#" class="ta-btn-icon ui-icon-minus ui-btn-icon-right">')
        .click(function() {
          that._remove(id);
        }).appendTo(el);
      el.appendTo(bd);
      that.breakdown.push(id);
      that.count++;
      bd.listview('refresh');
      text.addClass('ui-icon-bars ui-btn-icon-left');
      text.on('mousedown mouseup', function() {
        text.toggleClass('ta-grabbed');
      });
      that._sync(ev);
    },
    _remove: function(id, ev) {
      var i = 'bkdw' + id.replace(':', '_'),
        bd = $('#breakdown', this.element),
        el = $('#' + i, bd),
        that = this;
      if (!el.length)
        return;
      el.remove();
      that.breakdown.splice(that.breakdown.indexOf(id), 1);
      that.count--;
      bd.listview('refresh');
      that._sync(ev);
    },
    _sync: function(ev) {
      var placeholder,
        that = this,
        bds = $('#breakdowns', that.element),
        brkdwnButton = $('#breakdowns-button', that.element);
      if (ev)
        bds.selectmenu('close');
      if (that.count == 3) {
        if (ev)
          bds.selectmenu('close');
        bds.selectmenu('disable');
      } else {
        if (that.count < 3) {
          bds.selectmenu('enable');
        }
      }
      that._validate();
      /*
      if (!ev) {
        bds.val(that.breakdown.slice(0));
        bds.selectmenu('refresh');
      }
      */
      bds.val(that.breakdown);
      bds.selectmenu('refresh');
      $('span.ui-li-count', brkdwnButton).addClass('ui-screen-hidden');
      placeholder = $('span:not(.ui-li-count)', brkdwnButton);
      placeholder.text('Group' +
        (that.count ? 'ing ' + that.count + ' of 3' : ' By ..'));
      if (that.count == 3) {
        brkdwnButton.removeClass('ui-icon-plus').addClass('ui-icon-forbidden');
      } else if (brkdwnButton.hasClass('ui-icon-forbidden')) {
        brkdwnButton.removeClass('ui-icon-forbidden').addClass('ui-icon-plus');
      }
      //that.refresh();
    },
    _drawSince: function() {
      var that = this,
        since = $('#since', this.element),
        sincebtn = $('#since-button', this.element),
        sincelink = $('#sincelink', '#main'),
        sincelist = $('#since-listbox');
      sincebtn.on('click', function() {
        that.sincelinked = false;
      });
      sincelink.click(function() {
        sincelist.popup('option', 'positionTo', '#sincelink');
        since.selectmenu('open');
        that.sincelinked = true;
      });
      sincelist.on('popupafterclose', function() {
        sincelist.popup('option', 'positionTo', 'origin');
      });
      since.change(function(event) {
        var sel = since.val();
        if (!event)
          return;
        if (that.meta.since !== sel) {
          if (that.sincelinked)
            that.refresh();
          else if (that.isCollapsed && !that.isOpened)
            that.elem.view('menu').panel('open');
        } else {
          that.sincelinked = false;
        }
      });
    },
    _getSinceIndex: function(meta) {
      var lastsince;
      switch (meta.since) {
        case '0':
        case '-1':
        case '':
        case undefined:
        case null:
        case 0:
          lastsince = '-1';
          break;
        default:
          lastsince = meta.since;
          break;
      }
      return lastsince;
    }
  });

  $.widget('thinkingatoms.helptip', $.mobile.popup, {
    options: {
      tolerance: '0,0,0,0',
      timeout: 0,
      shiftX: 0.5,
      shiftY: 0.5,
      shift: true
    },
    _reposition: function(openOptions) {
      var opt = this.options;
      // We only care about position-related parameters for repositioning
      openOptions = {
        x: openOptions.x,
        y: openOptions.y,
        positionTo: openOptions.positionTo,
        arrow: openOptions.arrow !== undefined ? openOptions.arrow : opt.arrow,
        shift: openOptions.shift !== undefined ? openOptions.shift : opt.shift,
        shiftX: openOptions.shiftX !== undefined ? openOptions.shiftX : opt.shiftX,
        shiftY: openOptions.shiftY !== undefined ? openOptions.shiftY : opt.shiftY
      };
      opt.arrow = openOptions.arrow;
      this._trigger("beforeposition", undefined, openOptions);
      this._ui.container.offset(this._placementCoords(this._desiredCoords(openOptions)));
    },
    _desiredCoords: function(openOptions) {
      var offset,
        that = this,
        dst = null,
        windowCoordinates = getWindowCoordinates(this.window),
        a = openOptions.arrow,
        x = openOptions.x,
        y = openOptions.y,
        h = 0,
        shift = openOptions.shift,
        shiftX = openOptions.shiftX,
        shiftY = openOptions.shiftY,
        pTo = openOptions.positionTo;

      // Establish which element will serve as the reference
      if (pTo && pTo !== "origin") {
        if (pTo === "window") {
          x = windowCoordinates.cx / 2 + windowCoordinates.x;
          y = windowCoordinates.cy / 2 + windowCoordinates.y;
        } else {
          try {
            dst = $(pTo);
          } catch (err) {
            dst = null;
          }
          if (dst) {
            dst.filter(":visible");
            if (dst.length === 0) {
              dst = null;
            }
          }
        }
      }

      // If an element was found, center over it
      if (dst) {
        if (shift) {
          if (!a || a === true)
            try {
              a = that._getArrow(dst);
            } catch (e) {
              a = '';
            }
          switch (a) {
            case 'l':
              shiftX = 0.75;
              shiftY = 0.5;
              break;
            case 'r':
              shiftX = 0.25;
              shiftY = 0.5;
              break;
            case 't':
              shiftX = 0.5;
              shiftY = 0.75;
              break;
            case 'b':
              shiftX = 0.5;
              shiftY = 0.25;
              break;
            default:
              break;
          }
        }
        offset = dst.offset();
        x = dst.outerWidth();
        if (x === 0) {
          offset = dst[0].getBoundingClientRect();
          x = offset.left + offset.width * shiftX;
          y = offset.top + offset.height * shiftY;
          h = offset.top + offset.height;
        } else {
          x = offset.left + dst.outerWidth() * shiftX;
          y = offset.top + dst.outerHeight() * shiftY;
          h = offset.top + dst.outerHeight();
        }
        if (windowCoordinates.cy < h) {
          $(document).scrollTop(h - windowCoordinates.cy + windowCoordinates.y);
        } else if (0 > offset.top) {
          $(document).scrollTop(offset.top + windowCoordinates.y);
        }
      }
      that.options.arrow = a;

      // Make sure x and y are valid numbers - center over the window
      if ($.type(x) !== "number" || isNaN(x)) {
        x = windowCoordinates.cx / 2 + windowCoordinates.x;
      }
      if ($.type(y) !== "number" || isNaN(y)) {
        y = windowCoordinates.cy / 2 + windowCoordinates.y;
      }

      return {
        x: x,
        y: y
      };
    },
    _getArrow: function(el) {
      if (mediaSize() === 'small') {
        if ((el.offset().top - $(this.window).scrollTop()) / this.app.screenY > 0.5)
          return 'b';
        return 't';
      }
      if ((el.offset().left - $(this.window).scrollLeft()) / this.app.screenX > 0.5)
        return 'r';
      return 'l';
    },
    draw: function(tip) {
      var link;
      $('.ta-tooltip-tip', this.element).remove();
      $('<p class="ta-tooltip-tip">' + tip.html + '</p>').appendTo(this.element);
      delete tip.html;
      if (!tip.keep) {
        link = $('<a id="keepPopup" class="ta-tooltip-tip ui-btn ui-btn-inherit ui-btn-icon-left ui-checkbox-on ui-shadow-inset">Don\'t show this again</a>').appendTo(this.element);
        link.click(function(e) {
          e.stopPropagation();
          link.toggleClass('ui-checkbox-on').toggleClass('ui-checkbox-off')
            .toggleClass('ui-shadow-inset');
        });
      }
      delete tip.keep;
      if (this.activeKey)
        this.close();
      this.activeKey = tip.key;
      this.open(tip);
    }
  });

  $.widget('thinkingatoms.tooltip', $.thinkingatoms.ui, {
    options: {
      timeout: 10000,
      leaveTimeout: 2000,
      onTip: '<div class="ta-row">Ready</div><div class="ta-row">&nbsp;</div>',
      offTip: 'Powered off.'
    },
    _create: function() {
      var that = this;
      this._super();
      this.lastUntil = null;
      this.hide = function() {
        that.lastUntil = null;
        that.element.html(that.options.onTip);
      };
      this.template = _.template([
        '<div class="ta-row"><strong><%= title %></strong></div>',
        '<div class="ta-row">',
        '<div class="ta-key" style="<%= style %>"><%= date %></div>',
        '<div class="ta-value"><%= v %></div></div>'
      ].join(''));
      /*
      this.onLeave = function() {
        if (that.lastUntil)
          clearTimeout(that.lastUntil);
        that.lastUntil = setTimeout(that.hide, that.options.leaveTimeout);
      };
      */
    },
    _destroy: function() {
      this.lastUntil = null;
      this.element.html(this.options.offTip || '');
    },
    draw: function(tip) {
      if (!tip || !tip.asof) {
        this.app.log('INVALID DISPLAY:', tip);
        return;
      }
      if (tip && tip.title) {
        if (tip.source === 'perf') {
          tip.date = 'since ' + tip.asof;
          tip.style = 'width: 50%';
          this.options.onTip = this.template(tip);
          this.element.html(this.options.onTip);
        } else {
          tip.style = '';
          tip.date = 'up to ' + tip.asof;
          this.element.html(this.template(tip));
        }
      }
      if (this.lastUntil)
        clearTimeout(this.lastUntil);
      this.lastUntil = setTimeout(this.hide, this.options.timeout);
    }
  });

  $.widget('thinkingatoms.legend', $.thinkingatoms.ui, {
    _create: function() {
      var el = this.element;
      this._super();
      this.i = undefined;
      this.activeKey = null;
      this.showAll = true;
      this.items = d3.select(el[0]);
      this.count = 0;
      this.scroll = d3.behavior.drag().on('drag', function() {
        var check = d3.event.dy;
        if (Math.abs(check) < 1)
          return;
        check = el.scrollTop() - check;
        if (check < 0)
          check = 0;
        el.scrollTop(check);
      });
    },
    _destroy: function() {
      this.data = null;
      this.items.selectAll('li.ta-line').remove();
    },
    _resize: function() {
      var h, el = this.element;
      if (this.model.isMini) {
        el.slideDown();
        h = el.parent().outerHeight() - 5;
        h -= el.offset().top - el.parent().offset().top;
        el.css('max-height', Math.round(h) + 'px');
      } else {
        el.css('max-height', '');
        el.css('display', 'none');
      }
    },
    _tooltipContent: function(d) {
      var key = d && d.key;
      if (!key)
        return;
      this.activeKey = key;
      this.items.selectAll('li.ta-line').classed('ta-hover', function(d) {
        return d.key == key;
      });
      var val = {
        key: key,
        source: 'legend',
        title: d.meta.display,
        asof: this.model.cache.dates[this.i],
        w: d.weight,
        v: this.model.formatPercent(d.line[this.i])
      };
      return val;
    },
    prepare: function(metas) {
      this.data = metas.lines;
      if (this.i === undefined)
        this.i = metas.domain[1];
      else if (this.i < metas.domain[0])
        this.i = metas.domain[0];
      else if (this.i > metas.domain[1])
        this.i = metas.domain[1];
      this.draw();
    },
    _sort: function(a, b) {
      return (a.meta.display > b.meta.display) ? 1 : -1;
    },
    draw: function() {
      var items, data = _.values(this.data).sort(this._sort);
      items = this.items.selectAll('li.ta-line').data(data, this._keyMap);
      this.count = data.length;
      items.exit().remove();
      this._itemPosition(items);
      this._itemPosition(items.enter().append('li'), true);
    },
    _keyMap: function(d) {
      return d.key;
    },
    _itemPosition: function(e, initialize) {
      var that = this,
        i = that.i,
        format = that.model.formatPercent;
      if (initialize) {
        e.classed('ui-li-has-alt', true)
          .classed('ta-line', true)
          .call(that.activateTooltip);
        e.each(function(d) {
          var text, color,
            el = d3.select(this),
            meta = d.meta;
          text = el.append('a').attr('href', '#')
            .attr('class', 'ui-btn ui-btn-icon-right')
            .on('click', function(d) {
              if (d.meta.off) {
                el.classed('ta-disabled', false);
                color.classed('ui-icon-check', true)
                  .classed('ui-icon-delete', false);
                d.meta.off = false;
              } else {
                el.classed('ta-disabled', true);
                color.classed('ui-icon-check', false)
                  .classed('ui-icon-delete', true);
                d.meta.off = true;
              }
              that.fire('refreshLines');
            });
          text.html(['<div class="ta-row"><div class="ta-key"><p>',
            meta.display, '</p></div><div class="ta-value">',
            d.line ? format(d.line[i]) : '', '</div></div>'
          ].join(''));
          color = el.append('a').attr('href', '#')
            .attr('class', 'ui-btn ui-btn-icon-right ui-btn-icon-notext ui-icon-check')
            .style('background-color', d.meta.color).on('click', function(d) {
              if (color.classed('ui-icon-check')) {
                el.classed('ta-disabled', true);
                color.classed('ui-icon-check', false)
                  .classed('ui-icon-delete', true);
                d.meta.off = true;
                that.fire('refreshLines');
              } else {
                that.model.mungers.ts.remove(d.key);
              }
            });
          if (Modernizr.touch) {
            text.call(that.drag);
            color.call(that.scroll);
          }
        });
      } else {
        e.each(function(d) {
          var el = d3.select(this);
          el.classed('ta-hover', d.key == that.activeKey)
            .classed('ta-disabled', d.meta.off);
          el.select('div.ta-key').text(d.meta.display);
          if (d.line)
            el.select('div.ta-value').text(format(d.line[i]));
        });
      }
    },
    setActive: function(tip) {
      if (tip.key === undefined || tip.i === undefined)
        return;
      this.activeKey = tip.key;
      this.i = tip.i;
      this.draw();
    },
    toggle: function() {
      var that = this;
      if (that.element.css('display') === 'none') {
        that.element.slideDown();
        if (that.count >= 3)
          that.pub('Help', 'show', that.element, 'legendscroll');
        return;
      } else if (!that.model.isMini) {
        that.element.slideUp();
        return;
      } else {
        _.each(that.data, function(d) {
          d.meta.off = that.showAll;
        });
        that.showAll = !that.showAll;
        that.draw();
        that.fire('refreshLines');
      }
    }
  });

  $.widget('thinkingatoms.svg', $.thinkingatoms.ui, {
    options: {
      width: 475,
      height: 475,
      shiftX: 0,
      shiftY: 0,
      colors: COLORS.RdYlGn[13],
      colorDomain: [-1.65, 1.65],
      duration: 1000,
      easing: 'swing',
      //filterChildren: null,
      tooltip: null,
    },
    _create: function() {
      var palette,
        that = this,
        el = this.element,
        opt = this.options;

      this._super();

      this.data = null;
      this.vis = d3.select(el[0]).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', '0 0 ' + opt.width + ' ' + opt.height);
      this.icons = this.vis.append('g').classed('ta-icons', true)
        .attr('transform', 'translate(' + (opt.width - 35) + ', 20)');

      // colors
      palette = d3.scale.quantile()
        .range(d3.range(opt.colors.length))
        .domain(opt.colorDomain);
      if (!this.color)
        this.color = function(d) {
          return opt.colors[palette(d.field)];
        };

      // drag behavior
      if (Modernizr.touch) {
        this.drag = d3.behavior.drag().on('drag', function(d) {
          var touches, check = 0;
          check = Math.abs(d3.event.dx) + Math.abs(d3.event.dy);
          if (check < 1)
            return;
          d3.event.sourceEvent.preventDefault();
          touches = d3.event.sourceEvent.changedTouches;
          if (!touches)
            return;
          that.app.dragging = {
            x: touches[0].pageX,
            y: touches[0].pageY
          };
          that.showTooltip.call(this, d);
        }).on('dragend', function() {
          that.app.dragging = false;
        });
      } else {
        this.drag = d3.behavior.drag().on('drag', function(d) {
          var check = 0,
            opt = that.options;
          //d3.event.sourceEvent.stopPropagation();
          if (that.model.isMini)
            return;
          d3.event.sourceEvent.preventDefault();
          d.x += d3.event.dx;
          d.y += d3.event.dy;
          d3.select(this).attr('transform', 'translate(' + d.x + ',' + d.y + ')');
          check = Math.abs(d3.event.dx) + Math.abs(d3.event.dy);
          if (check < 1)
            return;
          if ((Math.abs(d.y - opt.shiftY) * 3 > opt.height) ||
            (Math.abs(d.x - opt.shiftX) * 3 > opt.width))
            that.fire('toggleMini');
        });
      }
    },
    _destroy: function() {
      var that = this;
      this.element.queue(function() {
        that.vis.transition().style('opacity', 0).remove()
          .each('end', function() {
            that.element.dequeue();
          });
      });
      this._super();
    },
    _tooltipContent: $.noop,
    _trans: function(el, duration, easing) {
      var opt = this.options;
      if (!easing)
        easing = opt.easing;
      if (!duration)
        duration = opt.duration;
      return el.transition().duration(duration).ease(easing);
    },
    _keyMap: function(d) {
      return d.i;
    }
  });

  $.widget('thinkingatoms.moonburst', $.thinkingatoms.svg, {
    options: {
      padding: 10,
      exponent: 0.7,
      minTextWidth: 0.03,
      minTextWithSmall: 0.05,
      //filterChildren: '> g.texts > text, > g.paths > path',
      insideout: false,
      max: 1,
      min: 0,
      back: 0.2
    },
    _create: function() {
      // options
      var that = this,
        opt = this.options,
        x, y;
      opt.height = opt.width;
      opt.shiftX = opt.shiftY = opt.width / 2;
      opt.radius = opt.shiftX - opt.padding;
      opt.maxRadius = opt.radius * opt.max;
      opt.minRadius = opt.radius * opt.min;
      that.lengths = {};
      that.beenClicked = false;
      that._super();
      //if (this.app.size !== 'small')
      //  that.vis.attr('width', '95%').attr('height', '95%');

      // d3
      x = that.x = d3.scale.linear().range([0, 2 * Math.PI]).clamp(true);
      y = that.y = d3.scale.pow().exponent(opt.exponent).domain([0, 1]).clamp(true);
      if (opt.insideout) {
        that.y.range([opt.maxRadius, opt.minRadius]).clamp(true);
      } else {
        that.y.range([opt.minRadius, opt.maxRadius]);
      }
      that.arcTween = function(d) {
        var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]);
        var yd = d3.interpolate(y.domain(), [that._minY(d), that._maxY(d)]);
        return function(d) {
          return function(t) {
            x.domain(xd(t));
            y.domain(yd(t));
            return that.arc(d);
          };
        };
      };
      that.arc = d3.svg.arc().startAngle(function(d) {
        return Math.max(0, Math.min(2 * Math.PI, x(d.x)));
      }).endAngle(function(d) {
        return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)));
      }).innerRadius(function(d) {
        return opt.insideout ? y(d.y + d.dy) : y(d.y);
      }).outerRadius(function(d) {
        return opt.insideout ? y(d.y) : y(d.y + d.dy);
      });
      that.partition = d3.layout.partition().sort(function(a, b) {
        return b.field - a.field;
      });
      that.g = that.vis.selectAll('g:not(.ta-icons)').data([{
        x: opt.shiftX,
        y: opt.shiftY
      }])
        .enter().append('g')
        .attr('transform', 'translate(' + opt.shiftX + ',' + opt.shiftY + ')')
        .call(that.drag);
      that.pathgroup = that.g.append('g').classed('paths', true);
      that.textgroup = that.g.append('g').classed('texts', true);
      that.nodes = that.paths = that.texts = null;

      // helpers
      that._textRotater = function(d) {
        var angle, rotate, translate, transform,
          padding = opt.padding,
          x = that.x,
          y = that.y,
          curr = that.meta.curr;
        if (!d.depth)
          return opt.insideout ? 'translate(0,' + (y(d.y) - padding) + ')' : '';
        angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
        rotate = angle > 90 ? angle + 1 : angle - 1;
        translate = opt.insideout || curr == d.i ?
          y(d.y + d.dy / 4) :
          y(d.y) + padding;
        transform = 'rotate(' + rotate + ')' + 'translate(' + translate + ')' +
          'rotate(' + (angle > 90 ? -180 : 0) + ')';
        if (curr == d.i)
          transform += 'rotate(' + (angle > 90 ? 90 : -90) + ')';
        return transform;
      };

      that._textAnchor = function(d) {
        var x = that.x;
        if (d.depth && !opt.insideout)
          return x(d.x + d.dx / 2) > Math.PI ? "end" : "start";
        return "middle";
      };

      that._textOpacity = function(d) {
        var depth, w,
          curr = that.meta.curr,
          max = that.app.size === 'small' ?
            opt.minTextWithSmall : opt.minTextWidth;
        if (d.opacity !== undefined)
          return d.opacity;
        if (that.app.size === 'small')
          if (d.i == curr) {
            return 1;
          } else if (d.parent && d.parent.i == curr) {
          return d.dx / d.parent.dx > max ? 1 : 0;
        } else {
          return 0;
        }
        curr = that.data[curr];
        if (!curr)
          return 0;
        if (!that._childOf(d, curr))
          return 0;
        depth = d.depth - curr.depth;
        w = d.dx / (curr.dx || 1) > max;
        if (!w)
          return 0;
        if (depth <= 1 || !d.parent.opacity ||
          that.lengths[d.parent.i] <= that._lengthCheck)
          return 1;
        w = Math.abs(d.x + d.dx / 2 - d.parent.x - d.parent.dx / 2) / (curr.dx || 1);
        return 1.2 * w > max ? 1 : 0;
      };

      that._textVisibility = function(e) {
        delete e.opacity;
        e.opacity = that._textOpacity(e);
        return e.opacity ? null : 'hidden';
      };
      that._textDark = function(d) {
        var ret;
        try {
          ret = brightness(d3.rgb(that.color(d))) > 170;
        } catch (e) {
          ret = false;
        }
        return ret;
      };

      that._minY = function(d) {
        var p = d.parent;
        if (p)
          return p.y + p.dy * 0.7;
        return 0;
      };
      that._maxY = function(d) {
        return d.children ?
          Math.max.apply(Math, d.children.map(that._maxY)) :
          d.y + d.dy;
      };

      that._childOf = function(c, p) {
        var i;
        if (p.i == that.meta.id || p === c || c.parent === p)
          return true;
        i = c.parent;
        while (i) {
          if (p === i)
            return true;
          i = i.parent;
        }
        return false;
      };

      this.click = function(d) {
        if (d3.event.defaultPrevented === false) {
          that.showTooltip.call(this, d);
          that._click(d);
        }
      };
      this._resize(this.app.size);
    },
    _tooltipContent: function(d) {
      if (!d.name)
        return;
      var val = {
        title: d.name + (d.id <= 0 ? '' : ' - ' + this.model.cache.names[d.i]),
        asof: 'today',
        w: d.value,
        v: d.display || this.model.formatPercent(d.field)
      };
      return val;
    },
    _resize: function(size) {
      var wh, that = this;
      that._super(size);
      if (size) {
        wh = size === 'small' ? '100%' : '95%';
        that.vis.attr('width', wh).attr('height', wh);
        that.textgroup.selectAll('text')
          .style('visibility', that._textVisibility)
          .style('opacity', that._textOpacity)
          .attr('transform', that._textRotater)
          .attr("text-anchor", that._textAnchor);
      }
    },
    _lights: function(on) {
      var that = this;
      that._super(on);
      if (on)
        return;
      that.textgroup.selectAll('text').classed('ta-alt-font', that._textDark);
    },
    prepare: function(meta, data) {
      var curr, that = this,
        rescale = false,
        isDetail = false;
      if (!that.meta || meta.key != that.meta.key) {
        rescale = true;
        that.meta = meta;
        that.element.clearQueue();
        that._lengthCheck = meta.set_cols.length > 2 ? 6 : 10;
      }
      curr = that.meta.curr;
      if (curr === undefined || !data[curr]) {
        curr = that.meta.curr = that.meta.id;
        rescale = true;
      } else if (data[curr].rescale) {
        delete data[curr].rescale;
        isDetail = true;
      }
      that.element.queue(function() {
        var d = data[curr],
          nodes = that.partition(data[that.meta.id]);
        if (rescale) {
          that.x.domain([d.x, d.x + d.dx]);
          that.y.domain([that._minY(d), that._maxY(d)]);
        }
        that.data = data;
        that.paths = that.pathgroup.selectAll('path').data(nodes, that._keyMap);
        that.texts = that.textgroup.selectAll('text').data(nodes, that._keyMap);
        that.paths.exit().remove();
        that.texts.exit().remove();
        that._pathPosition(that.paths, false);
        that._textPosition(that.texts, false);
        that._pathPosition(that.paths.enter().append('path'), true);
        that._textPosition(that.texts.enter().append('text'), true);
        if (rescale || isDetail)
          that.draw(d, 'refresh');
        else
          that.element.dequeue();
      });
    },
    _click: function(d) {
      var curr, clickType, that = this;
      if (that.model.isMini) {
        that.fire('toggleMini');
        return;
      }
      if (d.i == that.meta.curr) {
        if (d.parent || that.beenClicked)
          clickType = 'double';
      } else {
        curr = that.data[that.meta.curr];
        if (curr.parent && curr.parent.i == d.i)
          clickType = 'back';
      }
      that.meta.curr = d.i;
      that.element.queue(function() {
        if (d.id > 0 && clickType !== 'double') {
          that.fire('clicked', {
            type: clickType,
            data: d
          });
          that.element.dequeue();
        } else {
          that.draw(d, clickType);
        }
      });
      that.beenClicked = clickType !== 'back'; // true;
    },
    draw: function(d, clickType) {
      var t, that = this;
      t = that._trans(that.g);
      t.call(function(t) {
        t.select('g.paths').selectAll('path').attrTween('d', that.arcTween(d));
        that._textPosition(t.select('g.texts').selectAll('text'));
      }).each('end', function() {
        that.element.dequeue();
        if (clickType !== 'refresh')
          that.fire('clicked', {
            type: clickType,
            data: d
          });
      });
    },
    refreshValue: function(i, v) {
      var that = this;
      that.element.queue(function() {
        that.textgroup.selectAll('text').filter(function(d) {
          return d.i == i;
        }).select('tspan.value').text(function(d) {
          return v || d.display || d.field;
        });
        that.element.dequeue();
      });
    },
    _pathPosition: function(e, initialize) {
      var that = this;
      if (initialize)
        e.attr('id', function(d) {
          var i = d.i;
          if (typeof i !== 'string' && !(i instanceof String))
            i = i.toString();
          return 'pie' + i.replace(/,/g, '_');
        }).classed('root', function(d, i) {
          return !i;
        }).attr('d', that.arc).attr('fill-rule', 'evenodd')
          .on('click', that.click).call(that.activateTooltip);
      e.style('fill', that.color);
    },
    _textPosition: function(e, initialize) {
      var that = this,
        lights = that.app.state.game.lights;
      if (initialize) {
        e = e.attr('transform', that._textRotater)
          .attr("text-anchor", that._textAnchor)
          .classed('root', function(d) {
            return !d.depth;
          }).on('click', that.click).style('opacity', 0)
          .call(that.activateTooltip);
        e.each(function(d) {
          var el = d3.select(this),
            max = d.depth ? 13 : 15,
            name = d.name || '',
            len = name.length,
            top, bottom, mid;
          if (name.contains(' ') && len > max) {
            mid = Math.floor(len / 2);
            top = name.substr(0, mid).lastIndexOf(' ');
            bottom = name.substr(mid).indexOf(' ');
            if (bottom == -1)
              bottom = mid + 1;
            if (mid - top < bottom) {
              bottom = name.substr(top + 1);
              top = name.substr(0, top);
            } else {
              bottom += mid;
              top = name.substr(0, bottom);
              bottom = name.substr(bottom + 1);
            }
            el.attr('dy', '-.8em');
            el.append("tspan").attr("x", 0).text(top);
            el.append("tspan").attr("x", 0).attr('dy', '1em').text(bottom);
            if (d.depth)
              el.classed('twoline', true);
            len = Math.max(top.length, bottom.length);
          } else {
            el.attr('dy', '.2em');
            el.append('tspan').attr('x', 0)
              .text(name);
          }
          el.append("tspan").classed('value', true)
            .attr("x", 0).attr('dy', '1em')
            .text(d.display || d.field);
          that.lengths[d.i] = d.depth ? len : 0;
        }).style('visibility', that._textVisibility)
          .style('opacity', that._textOpacity);
        if (!lights)
          e.classed('ta-alt-font', that._textDark);
      } else if (initialize === false) {
        e.select('tspan.value').text(function(d) {
          return d.display || d.field;
        });
      } else {
        e.style('visibility', that._textVisibility)
          .filter(that._textOpacity).style('opacity', that._textOpacity)
          .attrTween('transform', function(e) {
            return function() {
              return that._textRotater(e);
            };
          }).each('end', function(d) {
            delete d.opacity;
            var el = d3.select(this);
            el.attr("text-anchor", that._textAnchor);
            if (!lights)
              el.classed('ta-alt-font', that._textDark);
          });
      }
    }
  });

  $.widget('thinkingatoms.xyzbubbles', $.thinkingatoms.svg, {
    options: {
      padding: 0,
      rollingWindow: 0,
      width: 500,
      height: 500,
      shiftX: 20,
      shiftY: 0,
      paddingTop: 10,
      minRadius: 5,
      maxRadius: 10
    },
    _create: function() {
      // options
      var that = this,
        opt = that.options;
      that._super();

      that.g = that.vis.selectAll('g:not(.ta-icons)').data([{
        x: opt.shiftX,
        y: 0
      }]).enter().append('g')
        .attr('transform', 'translate(' + opt.shiftX + ',' + opt.shiftY + ')')
        .call(that.drag);
      if (!Modernizr.touch)
        that.vis.on('dblclick', function() {
          d3.event.preventDefault();
          that.g.attr('transform', 'translate(' + opt.shiftX + ',' + opt.shiftY + ')');
          that.fire('toggleMini');
        });
      that._width = opt.width - opt.shiftX;
      that._height = opt.height - opt.shiftY;
      that.scales = {};
      that.domain = [0, -1];
      that.data = {};
      that.cache = {};
      that.activeKey = null;
      that.i = undefined;
      that.yLabel = that.g.append('text').attr('class', 'y label').text('(%)')
        .attr('x', '-2em').attr('y', '0.75em').style('opacity', 0);
      that.xGrid = that.g.append('g').attr('class', 'x grid');
      that.yGrid = that.g.append('g').attr('class', 'y grid');
      that.voronoi = that.g.append('g').attr('class', 'voronoi');
      that.points = that.g.append('g').attr('class', 'points');
      that.yAxis = that.g.append('g').attr('class', 'y axis');
      that.xAxis = that.g.append('g').attr('class', 'x axis');
      that.lines = that.g.append('g').attr('class', 'lines');
      that.dots = that.g.append('g').attr('class', 'dots');
      that._resize(that.app.size);
    },
    _destroy: function() {
      var i, d, that = this;
      delete that.data;
      d = that.scales;
      for (i in d)
        delete d[i];
      that._super();
    },
    _tooltipContent: function(d) {
      var i, parts, key, val, that = this;
      if (d.point) // voronoi
        key = d.point.key;
      else
        key = d.key;
      if (!key)
        return;
      if (key.contains('@')) {
        parts = key.split('@');
        key = parts[0];
        i = parseInt(parts[1]);
        if (i != that.i) {
          that.i = i;
        }
        d = that.data[key];
      }
      that.activeKey = key;
      that._linePosition(that.lines.selectAll('path'));
      that._dotPosition(that.dots.selectAll('circle'));
      val = {
        source: 'lines',
        key: key,
        i: i,
        title: d.meta.display,
        asof: that.model.cache.dates[that.i],
        w: d.weight,
        v: that.model.formatPercent(d.line[that.i])
      };
      return val;
    },
    _resize: function(size) {
      var w, h, vh,
        that = this,
        scales = that.scales,
        opt = that.options,
        p = that.element.parent(),
        legend = that.app.v.only('legend');
      that._super(size);
      if (that.model.isMini && that.app.size !== 'small')
        w = that.element.width() - 16;
      else
        w = p.width() - 32;
      h = Math.round(p.height() - that.element.offset().top + p.offset().top);
      if (legend.css('display') !== 'none' && !that.model.isMini)
        h += parseInt(legend.outerHeight());
      h -= 5;
      if (w < 1)
        w = 1;
      if (h < 1)
        h = 1;
      vh = Math.round(opt.width * h / w);
      if (vh <= opt.shiftY)
        vh = opt.shiftY + 1;
      that._height = vh - opt.shiftY;
      that.vis.attr('viewBox', '0 0 ' + opt.width + ' ' + vh)
        .attr('width', that.app.size === 'small' ? '100%' : '95%')
        .attr('height', h + 'px');
      if (scales.x) {
        scales.y.range([that._height, opt.paddingTop]);
        scales.voronoi.clipExtent([0, opt.paddingTop], [that._width, that._height]);
        scales.xGrid.tickSize(that._height - opt.paddingTop, 0, 0);
        that._setTicks();
        that.draw();
      }
    },
    _setTicks: function() {
      var t, that = this;
      t = (that.app.size === 'small') ? 5 : 8;
      that.scales.xAxis.ticks(t);
      that.scales.yAxis.ticks(t);
      that.scales.xGrid.ticks(t);
      that.scales.yGrid.ticks(t);
    },
    _lights: function(onOff) {
      var that = this;
      that._super(onOff);
      if (!that.scales.x)
        return;
      that.model.mungers.ts.updateColors(onOff);
      that.fire('refreshLegend', {
        i: this.i,
        key: this.activeKey,
        source: 'lines'
      });
      that.lines.selectAll('path').attr('stroke', that.color);
      that.dots.selectAll('circle').attr('stroke', that.color);
      /*
            that.items.selectAll('li').each(function(d) {
              var color = d3.select(this).select('a.ui-btn-icon-notext');
              color.style('background-color', d.color);
            });
            */
    },
    refresh: function() {
      var that = this;
      that._destroy();
      that.element.queue(function() {
        that._create();
        that.element.dequeue();
      });
    },
    color: function(d) {
      if (!d)
        return '#000';
      return d.meta.color;
    },
    prepare: function(metas) {
      if (metas) {
        this.domain = metas.domain;
        this.data = metas.lines;
        if (this.i === undefined)
          this.i = this.domain[1];
        else if (this.i < this.domain[0])
          this.i = this.domain[0];
        else if (this.i > this.domain[1])
          this.i = this.domain[1];
      }
      this.draw();
    },
    setActive: function(tip) {
      if (tip.key === undefined)
        return;
      this.activeKey = tip.key;
      this.lines.selectAll('path').classed('ta-hover', function(d) {
        return d.key == tip.key;
      });
    },
    draw: function() {
      var i, j, key, data, that = this,
        scales = that.scales,
        opt = that.options,
        lines, dots, point, points, voronoi;
      data = _.filter(that.data, function(d) {
        return !d.meta.off && d.line !== undefined;
      });
      that._rescale();
      lines = that.lines.selectAll('path').data(data, metaMap);
      dots = that.dots.selectAll('circle').data(data, metaMap);
      //items = that.items.selectAll('li').data(that.data, metaMap);

      dots.exit().remove();
      lines.exit().remove();

      that._dotPosition(dots);
      that._linePosition(lines);
      //that._itemPosition(items);

      if (data.length) {} else {
        that.g.classed('ta-disabled', true);
      }

      that._dotPosition(dots.enter().append('circle'), true);
      that._linePosition(lines.enter().append('path'), true);
      //that._itemPosition(items.enter().append('li'), true);

      // TODO legend sort

      if (data.length) {
        that.g.classed('ta-disabled', false);
        that.xAxis.call(scales.xAxis).style('opacity', 1)
          .attr('transform', 'translate(0,' + scales.cross[0] + ')');
        that.xGrid.call(scales.xGrid).style('opacity', 1)
          .attr('transform', 'translate(0,' + opt.paddingTop + ')');
        that.yAxis.call(scales.yAxis).style('opacity', 1)
          .attr('transform', 'translate(' + scales.cross[1] + ',0)');
        that.yGrid.call(scales.yGrid).style('opacity', 1);
        that.yLabel.style('opacity', 0.5);

        points = [];
        for (i in data) {
          i = data[i];
          key = i.key;
          if (!i.line)
            continue;
          i = i.line;
          for (j in i) {
            point = [j, i[j]];
            point.key = key + '@' + j;
            points.push(point);
          }
        }
        voronoi = that.scales.voronoi(points);
        points = that.points.selectAll('circle').data(points, metaMap);
        points.exit().remove();
        that._pointPosition(points);
        that._pointPosition(points.enter().append('circle'), true);
        try {
          voronoi = that.voronoi.selectAll('path').data(voronoi, voronoiMap);
          voronoi.exit().remove();
          that._voronoiPosition(voronoi.filter(badVoronoi));
          that._voronoiPosition(voronoi.enter()
            .append('path').filter(badVoronoi), true);
        } catch (e) {
          that.app.log('INVALID VORONOI', points);
        }
      } else {
        that.yLabel.style('opacity', 0);
        that.voronoi.selectAll('path').remove();
        points = that.points.selectAll('circle').remove();
      }

      function metaMap(d) {
        return d.key;
      }

      function voronoiMap(d) {
        var fail = !d || !d.length || isNaN(d[0][0]);
        if (fail) {
          if (d)
            d.fail = true;
          return;
        }
        d = d.point;
        return d.key;
      }

      function badVoronoi(d) {
        return d && !d.fail;
      }
    },
    _rescale: function() {
      var i, l, x, y, max = 0,
        min = 0,
        that = this,
        opt = that.options,
        scales = that.scales;
      for (i in that.data) {
        l = that.data[i];
        if (l.meta.off)
          continue;
        max = Math.max(max, l.max);
        min = Math.min(min, l.min);
      }
      that.range = [min, max];
      if (!scales.x) {
        scales.x = d3.scale.linear().domain(that.domain).range(
          [0, that._width]);
        scales.y = d3.scale.linear().domain(that.range).range(
          [that._height, opt.paddingTop]);
        scales.z = d3.scale.sqrt().domain([0, 100])
          .range([opt.minRadius, opt.maxRadius]);
        x = scales.x;
        y = scales.y;
        scales.line = d3.svg.line().interpolate('linear')
          .x(function(d, i) {
            return x(i);
          }).y(y);
        scales.xAxis = d3.svg.axis().orient('bottom')
          .scale(x).tickFormat('').outerTickSize(1);
        scales.xGrid = d3.svg.axis().orient('bottom')
          .scale(x).tickSize(that._height - opt.paddingTop, 0, 0).tickFormat('');
        scales.yAxis = d3.svg.axis().orient('left').scale(y);
        scales.yGrid = d3.svg.axis().orient('left').scale(y)
          .tickSize(-that._width, 0, 0).tickFormat('');
        that._setTicks();
        that.scales.voronoi = d3.geom.voronoi()
          .clipExtent([0, opt.paddingTop], [that._width, that._height])
          .x(function(d) {
            return x(d[0]);
          }).y(function(d) {
            return y(d[1]);
          });
      } else {
        scales.x.domain(that.domain);
        scales.y.domain(that.range);
      }
      scales.cross = [
        scales.y(max >= 0 && min <= 0 ? 0 : min),
        scales.x(that.domain[0])
      ];
      if (isNaN(scales.cross[1]))
        scales.cross[1] = 0;
    },
    _voronoiPosition: function(e, initialize) {
      var that = this;
      if (initialize) {
        e.call(that.activateTooltip);
      }
      e.attr('d', function(d) {
        return 'M' + d.join('L') + 'Z';
      });
    },
    _pointPosition: function(e, initialize) {
      var that = this,
        r = that.domain[1] - that.domain[0],
        x = that.scales.x,
        y = that.scales.y;
      if (r) {
        r = Math.round(that._width / r / 2);
        if (r < 2)
          r = Modernizr.touch ? 5 : 2;
      } else
        r = 10;
      if (initialize) {
        e.call(that.activateTooltip);
      }
      e.attr('cx', function(d) {
        return x(d[0]);
      }).attr('cy', function(d) {
        return y(d[1]);
      }).attr('r', r);
    },
    _linePosition: function(e, initialize) {
      var that = this,
        liner = that.scales.line;
      e.each(function(d) {
        var el = d3.select(this);
        if (initialize)
          el.attr('stroke', d.meta.color)
            .attr('title', d.meta.display);
        if (initialize !== false)
          el.attr('d', liner(d.line));
        el.classed('ta-hover', d.key == that.activeKey);
      });
    },
    _dotPosition: function(e, initialize) {
      var that = this,
        i = that.i,
        x = that.scales.x,
        y = that.scales.y,
        z = that.scales.z;
      e.each(function(d) {
        var el = d3.select(this),
          point = d.line[i];
        if (initialize) {
          el.call(that.activateTooltip)
            .attr('stroke', d.meta.color)
            .attr('title', d.meta.display);
        }
        el.attr('cx', x(i))
          .attr('cy', y(point))
          .attr('r', z(d.weight))
          .classed('ta-hover', d.key == that.activeKey);
      });
      e.sort(function(a, b) {
        return (b.weight - a.weight) || 0;
      });
    }
  });

}(Brainless, jQuery, _));

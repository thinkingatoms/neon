(function(Brainless, $, _, undefined) {
  var m = Brainless.thinkingatoms = {},
    fmtPct = d3.format(',.2f');

  m.Meta = function(server) {
    Brainless.Model.call(this);
    this.cache = server.cache;
    $(this).on('join', server.onJoin);
    $(this).on('leave', server.onLeave);
  };
  m.Meta.subclass(Brainless.Model, {
    type: 'Meta',
    formatPercent: function(x) {
      if ((!x && x !== 0) || isNaN(x))
        return 'N/A';
      return fmtPct(x) + '%';
    },
    munge: $.noop,
    remunge: $.noop,
    setFields: function() {
      var field, prefix, meta = this.value;
      if (!meta)
        return;
      prefix = meta.id + ':';
      if (meta.ret_type !== 'gross') // jshint ignore:line
        field = prefix + 'pr';
      else
        field = prefix + 'tr';
      if (meta.since)
        field += 'l';
      this.field = field;
      this.wgtField = meta.id + ':w';
    },
    _update: function(obj, opt) {
      var prev, curr, changed;
      if (_.isString(obj)) {
        obj = decodeKey(obj);
      } else {
        obj.key = encodeMeta(obj);
      }
      prev = this.key();
      changed = Brainless.Model.prototype._update.call(this, obj, opt);
      curr = this.key();
      if (changed) {
        this.setFields();
        if (prev !== curr) {
          $(this).trigger('leave', prev);
          if (curr)
            $(this).trigger('join', this.value);
        } else if (changed.ret_type) {
          if (this.cache)
            this.remunge();
        }
      }
    }
  });

  m.MetaCollection = function(server) {
    Brainless.Collection.call(this);
    this.server = server;
    this.perf = server.perf;
    this.cache = server.cache;
    $(this.perf).on('update', _.bind(this.reset, this));
    $(this).on('quotes', function(ev, secs) {
      if (!_.isArray(secs))
        secs = [secs];
      $(server.elem).quoter('tasked', secs, ev);
    });
  };
  m.MetaCollection.subclass(Brainless.Collection, {
    reset: $.noop,
    cls: m.Meta,
    add: function(value, key) {
      var meta;
      if (!key)
        key = encodeMeta(value);
      meta = this.values[key];
      if (!meta) {
        meta = this.values[key] = new this.cls(this.server);
        meta.manager = this;
        Brainless.Collection.prototype.add.call(this, meta, key);
      }
      meta.update(value);
    }
  });

  m.PerfMeta = function(opt) {
    m.Meta.call(this, opt);
  };
  m.PerfMeta.subclass(m.Meta, {
    type: 'PerfMeta',
    munge: function(key, data) {
      var i, j, row, comma, up, prev, hasDetails,
        // shortcuts
        q, names, f, w, meta, cache, format;
      if (key !== this.key())
        return;
      names = data.names;
      f = this.field;
      w = this.wgtField;
      //w = this.cols.w;
      meta = this.meta;
      cache = this.cache;
      format = this.formatPercent;
      // names
      for (i in names) {
        j = parseInt(i).toString();
        if (!cache.names[j])
          cache.names[j] = names[i];
      }
      names = cache.names;
      delete data.names;
      // queue the rows
      q = data.resp;
      prev = cache[key] || {};
      hasDetails = {};
      for (i in q) {
        comma = i.lastIndexOf(',');
        j = comma > 0 ? i.substr(comma + 1) : parseInt(i).toString();
        row = q[i];
        row.id = j;
        row.name = names[j];
        if (row.w) {
          row.w *= 0.01;
        } else {
          row.w = row[w] * 0.01;
        }
        row.value = row[w];
        row.field = row[f] / row.w;
        row.display = format(row.field);
        if (prev[i] && prev[i].origChildren !== undefined)
          hasDetails[i] = true;
        if (i == data.id)
          continue;
        up = i.substr(0, comma) || data.id;
        if (!q[up].children)
          q[up].children = [];
        q[up].children.push(row);
      }
      for (i in hasDetails) {
        row = q[i];
        row.origChildren = row.children || 0;
        row.children = prev[i].children;
        for (j in row.children) {
          j = row.children[j];
          if (j.parent)
            j.parent = row;
        }
      }
      q[data.id].since = data.since;
      delete cache[key];
      cache[key] = q;
      $(this).trigger('refresh', {
        'meta': meta,
        'data': q,
      });
      this.resetChanged(q);
    },
    resetChanged: function(data) {
      if (this.value && this.changed) {
        this.changed = {};
        $(this).trigger('tooltip', {
          source: 'perf',
          title: data[this.value.id].name,
          asof: data[this.value.id].since,
          v: (this.value.ret_type === 'gross' ? 'total' : 'price') + ' return'
        });
      }
    },
    remunge: function() {
      var i, j, row, d,
        f = this.field,
        format = this.formatPercent,
        data = this.cache[this.key()];
      if (!data)
        return;
      for (i in data) {
        row = data[i];
        row.field = row[f] / row.w;
        row.display = format(row.field);
        if (row.origChildren)
          for (j in row.origChildren) {
            d = row.origChildren[j];
            d.field = d[f] / d.w;
            d.display = format(d.field);
          }
      }
      $(this).trigger('refresh', {
        'meta': this.meta,
        'data': data
      });
      this.resetChanged();
    }
  });

  m.DetailMeta = function(opt) {
    m.Meta.call(this, opt);
    this.server = opt && opt.server;
  };
  m.DetailMeta.subclass(m.Meta, {
    type: 'DetailMeta',
    mungeSec: function(d) {
      if (d.exch) {
        if (d.exch.startsWith('NYSE')) {
          d.exch = 'NYSEMKT';
        } else if (d.exch != 'NASDAQ') {
          delete d.exch;
        }
      }
      if (d.name.contains(':')) {
        var parts = d.name.split(':');
        d.name = parts[0].replace('/', '.');
        if (!d.exch)
          d.exch = parts[1];
      }
      if (d.name.endsWith('-W'))
        d.name = d.name.replace('-W', '');
      return d;
    },
    munge: function(key, data) {
      var i, j, uprow, row,
        q, names, f, w, cache, perf, weight, format, clean,
        up = key.substr(key.lastIndexOf('|') + 1);

      if (key !== this.key())
        return;

      cache = this.cache;
      perf = cache[key];
      if (!perf || !perf[up])
        return;
      uprow = perf[up];
      weight = uprow.value;

      names = data[0];
      q = data[1];
      f = this.field;
      w = this.wgtField;
      format = this.formatPercent;
      clean = this.mungeSec;

      for (i in names) {
        j = parseInt(i).toString();
        cache.names[j] = names[i];
        cache.names[up + ',' + j] = names[i];
      }
      cache = 0;

      for (j in q) {
        row = q[j];
        row.id = row.i;
        row.i = up + ',' + row.i;
        if (row.w === undefined)
          row.w = row[w] * 0.01;
        row.value = row[w] * weight * 0.01;
        row.field = row[f] / row.w;
        row.display = format(row.field);
        row = clean(row);
        row.parent = uprow;
        perf[row.i] = row;
      }
      if (uprow.origChildren === undefined)
        uprow.origChildren = uprow.children || 0;
      uprow.children = q;
      uprow.rescale = true;
      if (this.manager) {
        $(this.manager.perf).trigger('refresh', {
          'meta': this.manager.perf.value,
          'data': perf
        });
        $(this.manager).trigger('quotes', q);
      }
    }
  });

  m.TSMeta = function(opt) {
    m.Meta.call(this, opt);
    this.server = opt && opt.server;
  };
  m.TSMeta.subclass(m.Meta, {
    type: 'TSMeta',
    setFields: function() {
      var key, cols = {},
        prefix = this.value.id + ':',
        suffix = this.value.args[0];
      if (!this.value.prefix) {
        key = this.key();
        this.value.prefix = key.substr(0, key.lastIndexOf('|'));
      }
      _.each(['w', 'tr', 'pr', 'trl', 'prl'], function(c) {
        cols[prefix + c] = c + suffix;
      });
      this.effField = 'f' + suffix;
      this.effWgtField = 'nw' + suffix;
      this.cols = cols;
      m.Meta.prototype.setFields.call(this);
    },
    color: function() {
      var c = d3.rgb(
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255));
      return this.adjustColor(c);
    },
    adjustColor: function(lightsOn) {
      var i = 0,
        c = this.value.color;
      c = d3.rgb(c);
      if (lightsOn)
        while (brightness(c) > 200 && ++i < 5)
          c = c.darker(1.1);
      else
        while (brightness(c) < 100 && ++i < 5)
          c = c.brighter(1.1);
      this.value.color = c.toString();
    },
    loadDates: function(cache, ts, ds) {
      var i, j = 0,
        changed = false,
        dates = cache.dates,
        index = cache.index;
      ds = ds.slice(0).sort();
      for (i in ds) {
        i = ds[i];
        if (!ts[i])
          ts[i] = {};
        if (!index[i]) {
          if (!dates[j]) {
            dates[j] = i;
            index[i] = j;
            changed = changed || true;
          } else {
            while (dates[j] < i && ++j < dates.length) {}
            if (j == cache.length) {
              dates[j] = i;
              index[i] = j;
              changed = changed || true;
            } else if (dates[j] == i) {
              continue;
            } else {
              dates.splice(j, 0, i);
              changed = 'reload';
            }
          }
        }
      }
      if (changed === 'reload') {
        index = cache.index = {};
        for (i in dates)
          index[dates[i]] = i;
      }
      return changed;
    },
    munge: function(key, data) {
      // r = row
      // c = col
      // cr = cached row
      var i, j, c, row, cachedRow, ts, parts, min, max, v,
        // shortcuts
        q, names, dates, changed,
        cols, w, ew, f, ef, end, tskey, sec, meta, cache, format;

      if (key !== this.key())
        return;
      names = data[0];
      dates = data[1];
      q = data[2];

      f = this.field;
      ef = this.effField;
      w = this.wgtField;
      ew = this.effWgtField;
      cols = this.cols;
      meta = this.value;
      end = meta.args[0];
      tskey = meta.prefix;
      sec = (meta.cmd === 'tssec');
      cache = this.cache;
      format = this.formatPercent;
      min = max = 0;

      for (i in names) {
        j = parseInt(i).toString();
        if (!cache.names[j])
          cache.names[j] = names[i];
      }
      names = cache.names;
      if (!cache[tskey])
        cache[tskey] = {};
      ts = cache[tskey];
      changed = this.loadDates(cache, ts, dates);
      for (i in q) {
        row = q[i];
        if (row.w) {
          row.w *= 0.01;
        } else {
          row.w = (row[w] || 100) * 0.01;
        }
        if (!sec)
          delete row.i;
        cachedRow = ts[dates[i]];
        for (c in cols)
          if (row[c] !== undefined)
            cachedRow[cols[c]] = row[c];
        if (sec) {
          v = cachedRow[ef] = row[f];
        } else {
          v = cachedRow[ef] = row[f] / row.w;
          cachedRow[ew] = row.w;
        }
        if (v < min)
          min = v;
        else if (v > max)
          max = v;
      }
      if (sec) {
        if (meta.name)
          meta.display = meta.name + ' - ' + names[end];
        else
          meta.display = names[end];
      } else if (!meta.display) {
        parts = end.split(',').reverse().map(function(i) {
          return names[i] || '';
        }).join(' : ');
        if (meta.id != end)
          meta.display = parts + ' : ' + names[meta.id];
        else
          meta.display = parts;
      }
      this.min = min;
      this.max = max;
      this.weight = row[this.wgtField] || 0;
      //this.of.fire('refreshLines', {
      //  'meta': meta,
      //});
      this.manager.load(meta, changed);
      if (sec)
        $(this.manager).trigger('quotes', [{
          id: parseInt(end),
          name: meta.name,
          desc: names[end]
        }]);
      else
        this.syncPerf(tskey, end, cachedRow[ef]);
    },
    remunge: function() {
      var i, cr, tskey = this.value.prefix,
        dates = this.cache.dates,
        cache = this.cache[tskey],
        f = this.cols[this.field],
        ef = this.effField,
        ew = this.effWgtField,
        sec = this.sec;
      if (!cache)
        return;
      for (i in dates) {
        i = dates[i];
        if (!cache[i])
          return;
        cr = cache[i];
        if (cr[f] === undefined)
          continue;
        if (sec)
          cr[ef] = cr[f];
        else
          cr[ef] = cr[f] / cr[ew];
      }
      this.manager.load(this.meta);
      this.syncPerf(tskey, this.value.args[0], cr[ef]);
    },
    syncPerf: function(tskey, i, val) {
      var f, perf = this.manager.perf,
        perfkey = perf.key(),
        perfPrefix = '.perf' + tskey.substr(3);
      if (perfkey.startsWith(perfPrefix)) {
        f = perf.field;
        perf = this.cache[perfkey];
        if (perf && perf[i]) {
          perf = perf[i];
          perf.field = val;
          perf.display = this.formatPercent(val);
          // TODO: alert single perf value
        }
      }
    }
  });

  m.DetailManager = function(server) {
    m.MetaCollection.call(this, server);
    this.ids = {};
  };
  m.DetailManager.subclass(m.MetaCollection, {
    type: 'DetailManager',
    cls: m.DetailMeta,
    add: function(value, key) {
      this.ids[value.args[0]] = value;
      m.MetaCollection.prototype.add.call(this, value, key);
    },
    remove: function(key) {
      var up = key.substr(key.lastIndexOf('|') + 1);
      delete this.ids[up];
      m.MetaCollection.prototype.remove.call(this, key);
    },
    reset: function() {
      var key, meta, perf = this.perf.value;
      for (key in this.values) {
        meta = this.values[key].value;
        if (meta && perf && meta.id == perf.id && meta.sets == perf.sets) {
          if (meta.since == perf.since && meta.ret_type == perf.ret_type)
            continue;
          this.values[key].update({
            'since': perf.since,
            'ret_type': perf.ret_type
          });
        } else {
          this.remove(key);
        }
      }
    },
  });

  m.TSManager = function(server) {
    m.MetaCollection.call(this, server);
  };
  m.TSManager.subclass(m.MetaCollection, {
    type: 'DetailManager',
    cls: m.TSMeta,
    reset: function() {
      var key, meta, perf = this.perf.value;
      for (key in this.values) {
        meta = this.values[key].value;
        if (meta.since == perf.since && meta.ret_type == perf.ret_type)
          continue;
        this.values[key].update({
          'since': perf.since,
          'ret_type': perf.ret_type
        });
      }
    },
    load: function(meta, all) {
      var i, d, cr, prev, ts, ef, line, dates, cache;
      if (all) {
        for (i in this.values)
          this.load(this.values[i].value);
        return;
      }
      ts = this.values[meta.key];
      ef = this.values[meta.key].effField;
      line = [];
      dates = this.cache.dates;
      cache = this.cache[meta.prefix];
      if (!cache || !dates)
        return;
      prev = 0;
      for (i in dates) {
        d = dates[i];
        cr = cache[d];
        if (cr && cr[ef] !== undefined)
          prev = cr[ef];
        line.push(prev);
      }
      ts.line = line;
      this.domain = [0, dates.length - 1];
      $(this).trigger('refresh', {
        domain: this.domain,
        lines: this.lines
      });
    }
  });

  m.Security = function(sec) {
    this.quote = null;
    $.extend(this, this.clean(sec));
  };
  m.Security.subclass(Brainless.Model, {
    type: 'Security',
    clean: function(d) {
      d = _.pick(d, 'id', 'name', 'exch', 'desc', 'global_id');
      if (d.exch) {
        if (d.exch.startsWith('NYSE')) {
          d.exch = 'NYSEMKT';
        } else if (d.exch != 'NASDAQ') {
          delete d.exch;
        }
      }
      if (d.name.contains(':')) {
        var parts = d.name.split(':');
        d.name = parts[0].replace('/', '.');
        if (!d.exch)
          d.exch = parts[1];
      }
      if (d.name.endsWith('-W'))
        d.name = d.name.replace('-W', '');
      return d;
    },
    getQuote: function() {
      return this.quote;
    },
    setQuote: function(quote) {
      this.quote = quote;
      if (quote)
        $(this).trigger('quoted');
    }
  });

  m.HelpTips = function(server) {
    Brainless.Collection.call(this);
    this.server = server;
    this.state = server.elem.state;
    if (!this.state.seen)
      this.state.seen = {};
    _.each(HELP_TIPS, this.add, this);
  };
  m.HelpTips.subclass(Brainless.Collection, {
    resetImportant: function() {
      var tip, seen = this.state.seen;
      if (!this.state.on) {
        for (tip in seen) {
          if ((this.helptips.values[tip] || {}).important)
            delete seen[tip];
        }
      }
    },
    getUnseen: function(tip) {
      var s, key = tip.key,
        seen = this.state.seen;
      while (seen[key]) {
        s = this.values[key];
        if (s.immediate && s.next) {
          key = s.next;
        } else
          return;
      }
      return this.values[key];
    },
    build: function(tip) {
      var el, text, popup, app = this.server._app();
      el = el === 'window' ? el : $(el || textOrExec.call(app, tip.el));
      text = el ? textOrExec.call(app, tip.text, el) : null;
      if (!text)
        return;
      if (Modernizr.touch)
        text = text
          .replace(/Click/g, 'Tap')
          .replace(/clicking/g, 'tapping')
          .replace(/click/g, 'tap')
          .replace(/Hover/g, 'Glide')
          .replace(/hover/g, 'glide');
      popup = {
        positionTo: el,
        arrow: tip.arrow !== undefined ? tip.arrow : true,
        html: text,
        keep: tip.keep
      };
      if (tip.shift !== undefined) {
        popup.shift = tip.shift;
        popup.shiftX = tip.shiftX;
        popup.shiftY = tip.shiftY;
      }
      return popup;
    }
  });

}(Brainless, jQuery, _));

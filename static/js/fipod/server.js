(function(Brainless, $, _, undefined) {

  var models = Brainless.thinkingatoms;

  $.widget('thinkingatoms.munger', $.brainless.server, {
    options: {
      background: false
    },
    _create: function() {
      var that = this;
      this._super();
      this.elem.socket.on('refresh', _.bind(this._munge, this));

      this.metas = this.elem.state.metas;
      if (!this.metas.map)
        this.metas.map = {};
      this.map = this.metas.map;
      if (!this.map.lines)
        this.map.lines = {};
      this.timeouts = {};
      this.cache = {
        keys: {},
        dates: [],
        index: {},
        names: {}
      };

      this.onJoin = function(ev, meta) {
        that._join(meta);
      };
      this.onLeave = function(ev, key) {
        that._leave(key);
      };
      this.perf = new models.PerfMeta(this);
      this.tsManager = new models.TSManager(this);
      this.detailManager = new models.DetailManager(this);
      this.perf.update(this.metas[this.map.wheel] ||
        decodeKey('.perf|-277|-30|-14:1,-14:2'));
      _.each(this.map.lines, function(v, key) {
        var meta = that.metas[key];
        if (!meta)
          return;
        that.tsManager.add(meta, key);
      });
    },
    onPerf: function(ev, func) {
      $(this.perf).on(ev, func);
    },
    onTS: function(ev, func) {
      $(this.tsmanager).on(ev, func);
    },
    joinTS: function(meta) {
      this.tsManager.add(meta);
    },
    leaveTS: function(key) {
      this.tsManager.remove(key);
    },
    joinDetail: function(meta) {
      if (!this.detailManager.ids[meta.args[0]])
        this.detailManager.add(meta);
    },
    leaveDetail: function(d) {
      var meta = this.detailManager.ids[d.i];
      if (meta)
        this.detailManager.leave(meta.key);
    },
    _join: function(meta) {
      var key = encodeMeta(meta);
      if (this.cache.keys[key])
        return;
      if (key.startsWith('.perf'))
        this.map.wheel = key;
      else if (key.startsWith('.ts') && this.map.lines[key] === undefined)
        this.map.lines[key] = true;
      this.metas[key] = $.extend(this.metas[key] || {}, meta);
      this.cache.keys[key] = true;
      this.elem.socket.emit('join', [meta]);
    },
    _leave: function(key) {
      delete this.cache.keys[key];
      this.elem.socket.emit('leave', key);
    },
    _munge: function(key, data) {
      var that = this;
      if (!this.cache.keys[key])
        return;
      if (this.timeouts[key])
        clearTimeout(this.timeouts[key]);
      this.timeouts[key] = setTimeout(function() {
        var munger;
        that.elem.log('pulled', key, data);
        if (key.startsWith('.perf'))
          munger = that.perf;
        else if (key.startsWith('.ts'))
          munger = that.tsManager.values[key];
        else if (key.startsWith('.detail'))
          munger = that.detailManager.values[key];
        if (munger)
          munger.munge(key, data);
        delete that.timeouts[key];
      }, 500);
    }
  });

  $.widget('thinkingatoms.quoter', $.brainless.server, {
    options: {
      quota: 100
    },
    _create: function() {
      this.ONEDAY_MS = 86400000;
      this.ONEMINUTE_MS = 60000;
      this.JSON_URL = '//www.google.com/finance/info?q=';
      this.CHART_URL = '//www.google.com/finance/getchart?q=';

      this._super();

      this.elem.socket.on('quotes', _.bind(this.tasked, this));
      this._on('done', _.bind(this._submit, this));
    },
    tasked: function(secs, force) {
      var key, sec, that = this,
        accepted = [];
      if (secs === 'stop') {
        this.stop();
        return accepted;
      }
      if (force || this.count < this.options.quota) {
        for (sec in secs) {
          sec = secs[sec];
          key = sec.id;
          if (!that.tasks[key]) {
            that.tasks[key] = new models.Security(sec);
            if (!force)
              that.count++;
          }
          sec = that.tasks[key];
          accepted.push(sec);
          if (that.count >= this.options.quota)
            break;
        }
      }
      if (!this.serving)
        this.start();
      return accepted;
    },
    _submit: function() {
      var quotes = _.filter(this.tasks, function(sec) {
        var quote = sec.getQuote();
        if (!quote || quote.submitted)
          return;
        quote.submitted = true;
        return quote;
      });
      if (quotes.length)
        this.elem.socket.emit('quotes', quotes);
    },
    _run: function(sec, key, opt) {
      var req, that = this,
        ticker = (sec.exch ? sec.exch + ':' : '') + sec.name,
        url = this.JSON_URL + ticker + '&callback=?';
      req = $.getJSON(url).done(function(data) {
        if (!data || !data.length) {
          sec.setQuote(null);
          return;
        }
        data = that._parse(data[0]);
        sec.setQuote(data);
        if (!opt || !opt.once)
          that.tasks[key || sec.id] = sec;
      }).fail(function() {
        req.abort();
        sec.setQuote(null);
      });
    },
    _parse: function(data) {
      var date, prevDate, price, prevPrice,
        quote = null,
        asof = this._parseTimestamp(data.lt_dts);
      if (asof) {
        date = this._parseTimestamp(data.lt_dts.split('T', 1)[0]);
        prevDate = this._getLastBDate();
        if (Math.abs(date - prevDate) > this.ONEDAY_MS)
          return null;
        price = this._parsePrice(data.l);
        if (!price)
          return null;
        prevPrice = this._parsePrice(data.pcls_fix);
        quote = {
          prevPrice: prevPrice,
          price: price,
          asof: asof.toISOString().split('T', 1)[0],
          modified_on: asof,
          price_ret: prevPrice ? (price / prevPrice - 1) * 100 : 0,
          submitted: false
        };
      }
      return quote;
    },
    _parseTimestamp: function(ts, asIs) {
      var date;
      if (!ts)
        return;
      date = new Date(ts);
      if (!asIs)
        date = new Date(date.getTime() +
          date.getTimezoneOffset() * this.ONEMINUTE_MS);
      return date;
    },
    _getLastBDate: function(date) {
      var day;
      if (!date)
        date = new Date();
      day = date.getDay();
      while (day == 6 || day === 0) {
        // FIXME: daylight savings
        date = new Date(date.getTime() - this.ONEDAY_MS);
        day = date.getDay();
      }
      return this._parseTimestamp(date.toISOString().split('T', 1)[0]);
    },
    _parsePrice: function(price) {
      if (!_.isString(price))
        return;
      if (price.contains(','))
        price = price.replace(',', '');
      price = parseFloat(price);
      if (isNaN(price) || Math.abs(price) <= 0.01)
        return;
      return price;
    },
    getChart: function(sec) {
      if (!sec.name)
        return;
      return this.CHART_URL + sec.name;
    }
  });

}(Brainless, jQuery, _));

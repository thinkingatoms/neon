var FIPOD = { // jshint ignore:line
  url: 'https://thinkingatoms.com',
  socket: '/gold',
  version: 2.0,
  state: (typeof STATE === 'undefined' ? null : STATE),
  debug: (typeof DEBUG === 'undefined' ? false : DEBUG),
  views: {
    body: 'body',
    page: 'body .thinkingatoms.ta-home',
    // header, under page
    header: '.ta-header',
    title: '.ta-header .ta-btn-home',
    // main, under page
    main: '#main.ta-main',
    welcome: '#main #welcome',
    manual: '#welcome .ui-block-b',
    fipod: '#main #graphs',
    screen: '#graphs #screen',
    wheel: '#graphs #wheel',
    lines: '#graphs #timeline',
    tooltip: '#screen #current',
    legend: '#screen #legend',
    // panels
    menu: '.ta-nav-panel',
    settings: '.ta-nav-panel #settings',
    sidepanels: '.ta-side-panel',
    soon: '#soon',
    disclaimer: '#disclaimer',
    about: '#about',
    contactform: '#contactform',
    // buttons
    headerButtons: '.ta-header .ta-responsive .ui-btn',
    menuButton: '.ta-header .ta-btn-nav',
    menuHomeButton: '.ta-nav-panel .ta-btn-home',
    homeButtons: '.ta-btn-home',
    helpButtons: '.ta-btn-start',
    lightButtons: '.ta-btn-lights',
    settingButtons: '.ta-btn-build',
    // misc
    lightIcons: '.ta-lights',
    reset: '#reset',
    search: '#search',
    searchResults: '#results',
    restart: '#restart',
    help: '#tooltip',
    win: window
  },
  texts: {
    fipod_title: 'My FiPod',
    fipod_menuHomeButton: "Owner's Manual",
    welcome_title: "Owner's Manual",
    welcome_menuHomeButton: 'Back to My FiPod'
  }
};

var HELP_TIPS = {
  init: {
    important: true,
    el: '.ta-header .ta-btn-home',
    text: function() {
      return ["Welcome to your new FiPod! Click here to see a quick manual.</p>",
        '<p class="ta-tooltip-tip">Click anywhere to dismiss this popup</p>',
        '<p class="ta-tooltip-tip"><a href="#" class="ui-btn ui-btn-icon-notext ',
        'ui-icon-navigation ui-btn-active ui-btn-inline"/> ',
        'Turns all popups off (or on)</p>',
        '<p class="ta-tooltip-tip"><a href="#" class="ui-btn ui-btn-icon-notext ',
        'ui-icon-gear ui-btn-inline"/>Changes your FiPod settings</p>',
        '<p class="ta-tooltip-tip"><a href="#" class="ui-btn ui-btn-icon-notext ',
        'ui-icon-eye ui-btn-inline"/>Changes your FiPod color',
        '<p class="ta-tooltip-tip"><a href="#" class="ui-btn ui-btn-icon-notext ',
        'ui-icon-bullets ta-lights ', (this.state.game.lights ? 'ui-alt-icon ' : ''),
        'ui-nodisc-icon ui-btn-inline"/>', (Modernizr.touch ?
          'More options (swipe right)' : '(on the left) More options')].join('');
    },
    arrow: 't',
    immediate: true,
    next: 'wheel'
  },
  wheel: {
    important: true,
    el: '#wheel g.paths path.root',
    text: function() {
      var fipod = this.parts.fipod,
        meta = fipod.mungers.perf.meta,
        cols = meta && meta.set_cols,
        text = 'This wheel represents a bunch of stocks many use to represent the market';
      if (meta) {
        text += '.</p><p class="ta-tooltip-tip">';
        if (meta.sets === '-14:1,-14:2') {
          text += 'The stocks are first grouped by sectors, and then by industry within each sector';
        } else {
          switch (cols.length) {
            case 1:
              text += 'The stocks are grouped by ' + fipod.getLevel(cols[0])
                .toLowerCase();
              break;
            case 2:
              text += ['The stocks are first grouped by ',
                fipod.getLevel(cols[0]).toLowerCase(),
                ', and then by ', fipod.getLevel(cols[1]).toLowerCase(),
                ' within each group'
              ].join('');
              break;
            case 3:
              text += ['The stocks are first grouped by ',
                fipod.getLevel(cols[0]).toLowerCase(),
                ', and then by ', fipod.getLevel(cols[1]).toLowerCase(),
                ' within each group, and finally by ',
                fipod.getLevel(cols[2]).toLowerCase()
              ].join('');
              break;
            default:
              break;
          }
        }
      }
      return text;
    },
    immediate: true,
    next: 'slice'
  },
  slice: {
    important: true,
    el: function() {
      var slices = d3.selectAll('#wheel g.texts text')
        .filter(function(d, i) {
          if (!i)
            return;
          return d3.select(this).style('opacity');
        });
      HELP_TIPS.browse.lastEl = slices[0][0];
      return HELP_TIPS.browse.lastEl;
    },
    text: function(el) {
      var d = d3.select(el[0]).datum(),
        name = d.name,
        text = 'For example, this part shows "' + name + '" stocks.</p>' +
          '<p class="ta-tooltip-tip">Its size reflects their combined market value, ' +
          "its color and percent number tells you how this group of stocks has been doing";
      return text;
    },
    immediate: true,
    next: 'browse'
  },
  browse: {
    el: function() {
      return HELP_TIPS.browse.lastEl || HELP_TIPS.slice.el();
    },
    text: 'The returns are up to date, with at most an hour of delay.</p>' +
      '<p class="ta-tooltip-tip">Hover around the wheel to browse, ' +
      "or click here to see what's underneath",
  },
  zoomed: {
    important: true,
    el: function() {
      var el, fipod = this.parts.fipod,
        meta = fipod.mungers.perf.meta;
      try {
        el = '#pie' + fipod.cache[meta.key][meta.curr || meta.id].i
          .toString().replace(',', '_');
      } catch (e) {
        el = '#wheel g.paths path.root';
      }
      return el;
    },
    text: function() {
      return 'Click the same slice again to see ' +
        '<b>top 50 stocks by market value weight</b>, ' +
        'or the center (home button) to zoom back out.</p>' +
        '<p class="ta-tooltip-tip">' +
        (Modernizr.touch ? 'Swipe downward on the wheel ' : 'Double-click the line graph or drag the wheel ') +
        'to <b>maximize the line graph</b>';
    }
  },
  legend: {
    important: true,
    el: '#current',
    text: 'Good stuff!  This shows the start and end dates for the returns.</p>' +
      '<p class="ta-tooltip-tip">Use the "clock" button (on the right) to change the start date</p>' +
      '<p class="ta-tooltip-tip">You can also click to see the legend ' +
      'and turn the lines on or off',
  },
  legendscroll: {
    important: true,
    el: '#legend',
    text: 'Hover over an item to highlight the cooresponding line.</p>' +
      '<p class="ta-tooltip-tip">Some browsers may hide the scroll bar, ' +
      'in that case, use the color checkboxes to scroll up and down'
  },
  mini: {
    el: '#wheel',
    text: 'Go big or go home (button) - click anywhere on the wheel ' +
      (Modernizr.touch ? '' : 'or double-click the line graph ') +
      'to get back',
    immediate: true,
    next: 'minilegend'
  },
  minilegend: {
    important: true,
    el: '#current',
    text: 'Click here to toggle all lines on/off'
  },
  settings: {
    el: '#nav .ui-collapsible-heading',
    text: 'Click here to customize your FiPod, ' +
      'its shortcut is the "gear" icon at top right',
  },
  bench: {
    el: function() {
      $('#settings').scrollTop(0);
      return '#nav #headline';
    },
    text: 'Here to select another stock market index or portfolio of interest',
  },
  levels: {
    important: true,
    el: '#nav .ui-select:first',
    text: 'select up to three ways to divide your index into groups',
    immediate: true,
    next: 'levelsort'
  },
  levelsort: {
    important: true,
    el: '#nav #breakdown',
    text: ['Order matters!  Stocks in your benchmark will be grouped ',
      'first by the top characteristic, then each group is divided by the second, ',
      'and so on.  Drag your selections to reorder them, click the minus sign to remove'
    ].join(''),
    immediate: Modernizr.touch,
    next: 'since',
  },
  since: {
    el: '#since-button',
    text: 'Set the start date for your benchmark returns here, ' +
      'its shortcut is the "clock" icon next to the legend',
    hover: !Modernizr.touch,
    immediate: Modernizr.touch,
    next: 'rettype',
  },
  rettype: {
    important: true,
    el: '#ret-type',
    text: 'Price return is the change in stock prices only, ' +
      'while total return also includes dividends.' +
      '</p><p class="ta-tooltip-tip">' +
      'Please note some of the special dividends from corporate actions ' +
      'may not be available, especially towards the beginning of the year.',
    hover: !Modernizr.touch,
    immediate: true,
    next: 'done',
  },
  done: {
    el: '#nav #build',
    text: function(el) {
      if (el.hasClass('ui-btn-active'))
        return 'Almost there! Click here if you are good to go';
      return;
    }
  },
  contact: {
    el: '#contact',
    text: 'Thank you very much for your message! ' +
      'We will get back to you as soon as possible',
    arrow: 'r',
    force: true,
    keep: true
  },
  notfound: {
    data: {
      name: 'security'
    },
    failout: null,
    el: '#search',
    text: function() {
      var d = this.parts.help.notfound,
        q = d.getQuote(),
        img = this.parts.quoter.GoogleQuoter('getChart', d),
        text = 'Sorry we do not track ' + d.name + (d.desc ? ' - ' + d.desc : '') +
          ' at the moment.</p>';
      if (q && q.price && q.modified_on)
        text += '<p class="ta-tooltip-tip">However, its price as of ' +
          q.modified_on.toLocaleString() + ' is ' + q.price + '.</p>';
      if (img)
        text += '<img class="ta-tooltip-tip" src="' + img +
          '" alt="Trying work-arounds.." style="width: 100%" />';
      return text;
    },
    force: true,
    keep: true
  }
};

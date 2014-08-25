import Ember from 'ember';
import { property, observer } from '../utils/computed-property-helpers';
import GraphActionContext from '../utils/nf/graph-action-context';

var computedBool = Ember.computed.bool;

var scaleFactoryProperty = function(axis) {
  return property(axis + 'ScaleType', axis + 'PowerExponent', function (type, powExp) {
    type = typeof type === 'string' ? type.toLowerCase() : '';
    
    if(type === 'linear') {
      return d3.scale.linear;
    }

    else if(type === 'ordinal') {
      return d3.scale.ordinal;
    }
    
    else if(type === 'power' || type === 'pow') {
      return function(){
        return d3.scale.pow().exponent(powExp);
      };
    }
    
    else if(type === 'log') {
      return d3.scale.log;
    }
    
    else {
      Ember.warn('unknown scale type: ' + type);
      return d3.scale.linear;
    }
  });
};

var domainProperty = function(axis) {
  return property(
    axis + 'Data', axis + 'Min', axis + 'Max', axis + 'ScaleType', axis + 'LogMin',
    function(data, min, max, scaleType, logMin) {
      var domain = null;

      if(scaleType === 'ordinal') {
        domain = data;
      } else {
        var extent = [min, max];

        if(scaleType === 'log') {
          if (extent[0] <= 0) {
            extent[0] = logMin;
          }
          if (extent[1] <= 0) {
            extent[1] = logMin;
          }
        }

        domain = extent;
      }

      return domain;
    }
  );
};

var scaleProperty = function(axis) {
  return property(
    axis + 'ScaleFactory', axis + 'Range', axis + 'Domain', axis + 'ScaleType', axis + 'Axis.tickCount', axis + 'OrdinalPadding', axis + 'OrdinalOuterPadding',
    function(scaleFactory, range, domain, scaleType, tickCount, ordinalPadding, ordinalOuterPadding) {
      var scale = scaleFactory();

      if(scaleType === 'ordinal') {
        scale = scale.domain(domain).rangeRoundBands(range, ordinalPadding, ordinalOuterPadding);
      } else {        
        scale = scale.domain(domain).range(range).clamp(true);
      }

      return scale;
    }
  );
};

var minProperty = function(axis, defaultTickCount){
  var _DataExtent_ = axis + 'DataExtent';
  var _MinMode_ = axis + 'MinMode';
  var _Axis_tickCount_ = axis + 'Axis.tickCount';
  var _ScaleFactory_ = axis + 'ScaleFactory';
  var __Min_ = '_' + axis + 'Min';
  var _prop_ = axis + 'Min';

  return function(key, value) {
    var mode = this.get(_MinMode_);
    var ext;

    if(arguments.length > 1) {
      this[__Min_] = value;
    } else {
      var change = function(val) {
        this.set(_prop_, val);
      }.bind(this);

      if(mode === 'auto') {
        change(this.get(_DataExtent_)[0] || 0);
      }

      else if(mode === 'push') {
        ext = this.get(_DataExtent_)[0];
        if(!isNaN(ext) && ext < this[__Min_]) {
          change(ext);
        }
      }

      else if(mode === 'push-tick') {
        var extent = this.get(_DataExtent_);
        ext = extent[0];

        if(!isNaN(ext) && ext < this[__Min_]) {
          var tickCount = this.get(_Axis_tickCount_) || defaultTickCount;
          var newDomain = this.get(_ScaleFactory_)().domain(extent).nice(tickCount).domain();
          change(newDomain[0]);
        }
      }
    }

    return this[__Min_];
  }.property(_MinMode_, _DataExtent_, _Axis_tickCount_, _ScaleFactory_);
};

var maxProperty = function(axis, defaultTickCount) {
  var _DataExtent_ = axis + 'DataExtent';
  var _Axis_tickCount_ = axis + 'Axis.tickCount';
  var _ScaleFactory_ = axis + 'ScaleFactory';
  var _MaxMode_ = axis + 'MaxMode';
  var __Max_ = '_' + axis + 'Max';
  var _prop_ = axis + 'Max';

  return function(key, value) {
    var mode = this.get(_MaxMode_);
    var ext;

    if(arguments.length > 1) {
      this[__Max_] = value;
    } else {
      var change = function(val) {
        this.set(_prop_, val);
      }.bind(this);

      if(mode === 'auto') {
        change(this.get(_DataExtent_)[1] || 1);
      }

      else if(mode === 'push') {
        ext = this.get(_DataExtent_)[1];
        if(!isNaN(ext) && this[__Max_] < ext) {
          change(ext);
        }
      }

      else if(mode === 'push-tick') {
        var extent = this.get(_DataExtent_);
        ext = extent[1];

        if(!isNaN(ext) && this[__Max_] < ext) {
          var tickCount = this.get(_Axis_tickCount_) || defaultTickCount;
          var newDomain = this.get(_ScaleFactory_)().domain(extent).nice(tickCount).domain();
          change(newDomain[1]);
        }
      }
    }

    return this[__Max_];
  }.property(_MaxMode_, _DataExtent_, _ScaleFactory_, _Axis_tickCount_);
};

/**
  A container component for building complex Cartesian graphs.

  ## Minimal example

       {{#nf-graph width=100 height=50}}
         {{#nf-graph-content}}
           {{nf-line data=lineData xprop="foo" yprop="bar"}}
         {{/nf-graph-content}}
       {{/nf-graph}}

  The above will create a simple 100x50 graph, with no axes, and a single line
  plotting the data it finds on each object in the array `lineData` at properties
  `foo` and `bar` for x and y values respectively.

  ## More advanced example

       {{#nf-graph width=500 height=300}}
         {{#nf-x-axis height="50"}}
           <text>{{tick.value}}</text>
         {{/nf-x-axis}}
   
         {{#nf-y-axis width="120"}}
           <text>{{tick.value}}</text>
         {{/nf-y-axis}}
   
         {{#nf-graph-content}}
           {{nf-line data=lineData xprop="foo" yprop="bar"}}
         {{/nf-graph-content}}
       {{/nf-graph}}

  The above example will create a 500x300 graph with both axes visible. The graph will not 
  render either axis unless its component is present.


  @namespace components
  @class nf-graph
  @extends Ember.Component
*/
export default Ember.Component.extend({
  tagName: 'div',  

  /**
    The exponent to use for xScaleType "pow" or "power".
    @property xPowerExponent
    @type Number
    @default 3
  */
  xPowerExponent: 3,

  /**
    The exponent to use for yScaleType "pow" or "power".
    @property yPowerExponent
    @type Number
    @default 3
  */
  yPowerExponent: 3,

  /**
    The min value to use for xScaleType "log" if xMin <= 0
    @property xLogMin
    @type Number
    @default 0.1
  */
  xLogMin: 0.1,

  /**
    The min value to use for yScaleType "log" if yMin <= 0
    @property yLogMin
    @type Number
    @default 0.1
  */
  yLogMin: 0.1,

  /** 
    Allows child compoenents to identify graph parent.
    @property isGraph
  */
  isGraph: true,

  /**
    @property hasRendered
    @private
  */
  hasRendered: false,

  /**
    Gets or sets the whether or not multiple selectable graphics may be
    selected simultaneously.
    @property selectMultiple
    @type Boolean
    @default false
  */
  selectMultiple: false,

  /**
    The width of the graph in pixels.
    @property width
    @type Number
    @default 300
  */
  width: 300,

  /**
    The height of the graph in pixels.
    @property height
    @type Number
    @default 100
  */
  height: 100,

  /**
    The padding at the top of the graph
    @property paddingTop
    @type Number
    @default 0
  */
  paddingTop: 0,

  /**
    The padding at the left of the graph
    @property paddingLeft
    @type Number
    @default 0
  */
  paddingLeft: 0,

  /**
    The padding at the right of the graph
    @property paddingRight
    @type Number
    @default 0
  */
  paddingRight: 0,

  /**
    The padding at the bottom of the graph
    @property paddingBottom
    @type Number
    @default 0
  */
  paddingBottom: 0,

  /**
    Determines whether to display "lanes" in the background of
    the graph.
    @property showLanes
    @type Boolean
    @default false
  */
  showLanes: false,

  /**
    Determines whether to display "frets" in the background of
    the graph.
    @property showFrets
    @type Boolean
    @default false 
  */
  showFrets: false,

  /**
    The type of scale to use for x values.
    
    Possible Values:
    - `'linear'` - a standard linear scale
    - `'log'` - a logarithmic scale
    - `'power'` - a power-based scale (exponent = 3)
    - `'ordinal'` - an ordinal scale, used for ordinal data. required for bar graphs.
    
    @property xScaleType
    @type String
    @default 'linear'
  */
  xScaleType: 'linear',

  /**
    The type of scale to use for y values.
    
    Possible Values:
    - `'linear'` - a standard linear scale
    - `'log'` - a logarithmic scale
    - `'power'` - a power-based scale (exponent = 3)
    - `'ordinal'` - an ordinal scale, used for ordinal data. required for bar graphs.
    
    @property yScaleType
    @type String
    @default 'linear'
  */
  yScaleType: 'linear',
  
  /**
    The padding between value steps when `xScaleType` is `'ordinal'`
    @property xOrdinalPadding
    @type Number
    @default 0.1
  */
  xOrdinalPadding: 0.1,

  /**
    The padding at the ends of the domain data when `xScaleType` is `'ordinal'`
    @property xOrdinalOuterPadding
    @type Number
    @default 0.1
  */
  xOrdinalOuterPadding: 0.1,

  /**
    The padding between value steps when `xScaleType` is `'ordinal'`
    @property yOrdinalPadding
    @type Number
    @default 0.1
  */
  yOrdinalPadding: 0.1,

  /**
    The padding at the ends of the domain data when `yScaleType` is `'ordinal'`
    @property yOrdinalOuterPadding
    @type Number
    @default 0.1
  */
  yOrdinalOuterPadding: 0.1,

  /**
    the `nf-y-axis` component is registered here if there is one present
    @property yAxis
    @readonly
    @default null
  */
  yAxis: null,

  /**
    The `nf-x-axis` component is registered here if there is one present
    @property xAxis
    @readonly
    @default null
  */
  xAxis: null,

  /**
    Backing field for `xMin`
    @property _xMin
    @private
  */
  _xMin: null,

  /**
    Backing field for `xMax`
    @property _xMax
    @private
  */
  _xMax: null,

  /**
    Backing field for `yMin`
    @property _yMin
    @private
  */
  _yMin: null,

  /**
    Backing field for `yMax`
    @property _yMax
    @private
  */
  _yMax: null,

  /**
    Gets or sets the minimum x domain value to display on the graph.
    Behavior depends on `xMinMode`.
    @property xMin
  */
  xMin: minProperty('x', 8),

  /**
    Gets or sets the maximum x domain value to display on the graph.
    Behavior depends on `xMaxMode`.
    @property xMax
  */
  xMax: maxProperty('x', 8),

  /**
    Gets or sets the maximum y domain value to display on the graph.
    Behavior depends on `yMaxMode`.
    @property yMax
  */
  yMin: minProperty('y', 5),

  /**
    Gets or sets the maximum y domain value to display on the graph.
    Behavior depends on `yMaxMode`.
    @property yMax
  */
  yMax: maxProperty('y', 5),
  

  /**
    Sets the behavior of `xMin` for the graph.

    ### Possible values:

    - 'auto': (default) xMin is always equal to the minimum domain value contained in the graphed data. Cannot be set.
    - 'fixed': xMin can be set to an exact value and will not change based on graphed data.
    - 'push': xMin can be set to a specific value, but will update if the minimum x value contained in the graph is less than 
      what xMin is currently set to.
    - 'push-tick': xMin can be set to a specific value, but will update to next "nice" tick if the minimum x value contained in
      the graph is less than that xMin is set to.

    @property xMinMode
    @type String
    @default 'auto'
  */
  xMinMode: 'auto',

  /**
    Sets the behavior of `xMax` for the graph.

    ### Possible values:

    - 'auto': (default) xMax is always equal to the maximum domain value contained in the graphed data. Cannot be set.
    - 'fixed': xMax can be set to an exact value and will not change based on graphed data.
    - 'push': xMax can be set to a specific value, but will update if the maximum x value contained in the graph is greater than 
      what xMax is currently set to.
    - 'push-tick': xMax can be set to a specific value, but will update to next "nice" tick if the maximum x value contained in
      the graph is greater than that xMax is set to.
      
    @property xMaxMode
    @type String
    @default 'auto'
  */
  xMaxMode: 'auto',

  /**
    Sets the behavior of `yMin` for the graph.

    ### Possible values:

    - 'auto': (default) yMin is always equal to the minimum domain value contained in the graphed data. Cannot be set.
    - 'fixed': yMin can be set to an exact value and will not change based on graphed data.
    - 'push': yMin can be set to a specific value, but will update if the minimum y value contained in the graph is less than 
      what yMin is currently set to.
    - 'push-tick': yMin can be set to a specific value, but will update to next "nice" tick if the minimum y value contained in
      the graph is less than that yMin is set to.

    @property yMinMode
    @type String
    @default 'auto'
  */
  yMinMode: 'auto',

  /**
    Sets the behavior of `yMax` for the graph.

    ### Possible values:

    - 'auto': (default) yMax is always equal to the maximum domain value contained in the graphed data. Cannot be set.
    - 'fixed': yMax can be set to an exact value and will not change based on graphed data.
    - 'push': yMax can be set to a specific value, but will update if the maximum y value contained in the graph is greater than 
      what yMax is currently set to.
    - 'push-tick': yMax can be set to a specific value, but will update to next "nice" tick if the maximum y value contained in
      the graph is greater than that yMax is set to.
      
    @property yMaxMode
    @type String
    @default 'auto'
  */
  yMaxMode: 'auto',

  /**
    Gets the highest and lowest x values of the graphed data in a two element array.
    @property xDataExtent
    @type Array
    @readonly
  */
  xDataExtent: property('xData.@each', function(xData) {
    return xData ? d3.extent(xData) : [null, null];
  }),

  /**
    Gets the highest and lowest y values of the graphed data in a two element array.
    @property yDataExtent
    @type Array
    @readonly
  */
  yDataExtent: property('yData.@each', function(yData) {
    return yData ? d3.extent(yData) : [null, null];
  }),

  /**
    Gets all x data from all graphics.
    @property xData
    @type Array
    @readonly
  */
  xData: property('graphics.@each.xData', function(graphics) {
    var all = [];
    graphics.forEach(function(graphic) {
      all = all.concat(graphic.get('xData'));
    });
    return all;
  }),

  /**
    Gets all y data from all graphics
    @property yData
    @type Array
    @readonly
  */
  yData: property('graphics.@each.yData', function(graphics) {
    var all = [];
    graphics.forEach(function(graphic) {
      all = all.concat(graphic.get('yData'));
    });
    return all;
  }),

  /**
    Gets the DOM id for the content clipPath element.
    @property contentClipPathId
    @type String
    @readonly
    @private
  */
  contentClipPathId: function(){
    return this.get('elementId') + '-content-mask';
  }.property('elementId'),

  /**
    Registry of contained graphic elements such as `nf-line` or `nf-area` components.
    This registry is used to pool data for scaling purposes.
    @property graphics
    @type Array
    @readonly
   */
  graphics: null,

  /**
    An array of "selectable" graphics that have been selected within this graph.
    @property selected
    @type Array
    @readonly
  */
  selected: null,

  /**
    Computed property to show yAxis. Returns `true` if a yAxis is present.
    @property showYAxis
    @type Boolean
    @default false
   */
  showYAxis: computedBool('yAxis'),

  /**
    Computed property to show xAxis. Returns `true` if an xAxis is present.
    @property showXAxis
    @type Boolean
    @default false
   */
  showXAxis: computedBool('xAxis'),

  /**
    Gets a function to create the xScale
    @property xScaleFactory
    @readonly
   */
  xScaleFactory: scaleFactoryProperty('x'),

  /**
    Gets a function to create the yScale
    @property yScaleFactory
    @readonly
   */
  yScaleFactory: scaleFactoryProperty('y'),

  /**
    Gets the domain of x values.
    @property xDomain
    @type Array
    @readonly
   */
  xDomain: domainProperty('x'),

  /**
    Gets the domain of y values.
    @property yDomain
    @type Array
    @readonly
   */
  yDomain: domainProperty('y'),

  /**
    Gets the current xScale used to draw the graph.
    @property xScale
    @type Function
    @readonly
   */
  xScale: scaleProperty('x'),

  /**
    Gets the current yScale used to draw the graph.
    @property yScale
    @type Function
    @readonly
   */
  yScale: scaleProperty('y'),

  /**
    Registers a graphic such as `nf-line` or `nf-area` components with the graph.
    @method registerGraphic
    @param graphic {Ember.Component} The component object to register
   */
  registerGraphic: function (graphic) {
    var graphics = this.get('graphics');
    graphics.pushObject(graphic);
  },

  /**
    Unregisters a graphic such as an `nf-line` or `nf-area` from the graph.
    @method unregisterGraphic
    @param graphic {Ember.Component} The component to unregister
   */
  unregisterGraphic: function(graphic) {
    var graphics = this.get('graphics');
    graphics.removeObject(graphic);
  },
  
  /**
    The y range of the graph in pixels. The min and max pixel values
    in an array form.
    @property yRange
    @type Array
    @readonly
   */
  yRange: property('graphHeight', function (graphHeight) {
    return [graphHeight, 0];
  }),

  /**
    The x range of the graph in pixels. The min and max pixel values
    in an array form.
    @property xRange
    @type Array
    @readonly
   */
  xRange: property('graphWidth', function (graphWidth) {
    return [0, graphWidth];
  }),

  /**
    Returns `true` if the graph has data to render. Data is conveyed
    to the graph by registered graphics.
    @property hasData
    @type Boolean
    @default false
    @readonly
   */
  hasData: property('graphics', function(graphics) {
    return graphics && graphics.length > 0;
  }),

  /**
    The x coordinate position of the graph content
    @property graphX
    @type Number
    @readonly
   */
  graphX: property(
    'paddingLeft', 'yAxis.width', 'yAxis.orient', 
    function (paddingLeft, yAxisWidth, yAxisOrient) {
      if(yAxisOrient === 'right') {
        return paddingLeft;
      }
      return paddingLeft + yAxisWidth;
    }
  ),

  /** 
    The y coordinate position of the graph content
    @property graphY
    @type Number
    @readonly
   */
  graphY: property('paddingTop', 'xAxis.orient', 'xAxis.height', 
    function (paddingTop, xAxisOrient, xAxisHeight) {
      if(xAxisOrient === 'top') {
        return xAxisHeight + paddingTop;
      }
      return paddingTop;
    }
  ),

  /**
    The width, in pixels, of the graph content
    @property graphWidth
    @type Number
    @readonly
   */
  graphWidth: property('width', 'paddingRight', 'paddingLeft', 'yAxis.width',
    function (width, paddingLeft, paddingRight, yAxisWidth) {
      paddingRight = paddingRight || 0;
      paddingLeft = paddingLeft || 0;
      yAxisWidth = yAxisWidth || 0;
      return width - paddingRight - paddingLeft - yAxisWidth;
    }
  ),

  /**
    The height, in pixels, of the graph content
    @property graphHeight
    @type Number
    @readonly
   */
  graphHeight: property('height', 'paddingTop', 'paddingBottom', 'xAxis.height',
    function (height, paddingTop, paddingBottom, xAxisHeight) {
      paddingTop = paddingTop || 0;
      paddingBottom = paddingBottom || 0;
      xAxisHeight = xAxisHeight || 0;
      return height - paddingTop - paddingBottom - xAxisHeight;
    }
  ),

  /**
    An SVG transform to position the graph content
    @property graphTransform
    @type String
    @readonly
   */
  graphTransform: property('graphX', 'graphY', function (graphX, graphY) {
    return 'translate(%@, %@)'.fmt(graphX, graphY);
  }),

  /**
    Sets `hasRendered` to `true` on `willInsertElement`.
    @method _notifyHasRendered
    @private
  */
  _notifyHasRendered: function () {
    this.set('hasRendered', true);
  }.on('willInsertElement'),

  /**
    event handler for mouse movement inside the `graphContentGroup`
    @method _contentMouseMove
    @param e {MouseEvent} the DOM mouse event
    @private
  */
  _contentMouseMove: function(e) {
    var graphContentGroup = this.get('graphContentGroup');
    var mouse = this.mousePoint(graphContentGroup[0], e);
    this.set('mouseX', mouse[0]);
    this.set('mouseY', mouse[1]);
  },

  /**
    Event handler for mouse leaving the `graphContentGroup`
    @method _contentMouseLeave
    @private
  */
  _contentMouseLeave: function() {
    this.set('mouseX', -1);
    this.set('mouseY', -1);
  },

  /**
    Gets the elements for the `svg` and `graphContentGroup` properties. Also wires up
    DOM events for the graph. Fires on `didInsertElement`
    @method _registerDOM
    @private
  */
  _registerDOM: function () {
    var graphContentGroup = this.$('.nf-graph-content');
    this.set('svg', this.$('svg'));
    this.set('graphContentGroup', graphContentGroup);
    graphContentGroup.on('mousemove', this._contentMouseMove.bind(this));
    graphContentGroup.on('mouseleave', this._contentMouseLeave.bind(this));
  }.on('didInsertElement'),

  /**
    Gets the mouse position relative to the container
    @method mousePoint
    @param container {SVGElement} the SVG element that contains the mouse event
    @param e {Object} the DOM mouse event
    @return {Array} an array of `[xMouseCoord, yMouseCoord]`
   */
  mousePoint: function (container, e) {
    var svg = container.ownerSVGElement || container;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      point = point.matrixTransform(container.getScreenCTM().inverse());
      return [ point.x, point.y ];
    }
    var rect = container.getBoundingClientRect();
    return [ e.clientX - rect.left - container.clientLeft, e.clientY - rect.top - container.clientTop ];
  },

  /**
    A computed property returned the view's controller.
    @property parentController
    @type Ember.Controller
    @readonly
  */
  parentController: Ember.computed.alias('templateData.view.controller'),

  /**
    The x pixel value of the current mouse hover position.
    Will be `-1` if the mouse is not hovering over the graph content
    @property mouseX
    @type Number
    @default -1
  */
  mouseX: -1,

  /**
    The y pixel value of the current mouse hover position.
    Will be `-1` if the mouse is not hovering over the graph content.
    @property mouseY
    @type Number
    @default -1
  */
  mouseY: -1,

  /**
    Gets the x domain value at the current mouse x hover position.
    @property hoverX
    @readonly
  */
  hoverX: null,

  /**
    Gets teh y domain value at the current mouse y hover position.
    @property hoverY
    @readonly
  */
  hoverY: null,

  /**
    updates `hoverX` when `mouseX` changes or something causes the scale to change.
    @method updateHoverX
    @private
  */
  updateHoverX: observer('mouseX', 'xScale', function(mouseX, xScale){
    var hx = mouseX !== -1 && xScale && xScale.invert ? xScale.invert(mouseX) : null;
    this.set('hoverX', isNaN(hx) ? null : hx);
  }),

  /**
    updates `hoverY` when `mouseY` changes or something causes the scale to change.
    @method updateHoverY
    @private
  */  
  updateHoverY: observer('mouseY', 'yScale', function(mouseY, yScale) {
    var hy = mouseY !== -1 && yScale && yScale.invert ? yScale.invert(mouseY) : null;
    this.set('hoverY', isNaN(hy) ? null : hy);
  }),

  /**
    Selects the graphic passed. If `selectMultiple` is false, it will deselect the currently
    selected graphic if it's different from the one passed.
    @method selectGraphic
    @param graphic {Ember.Component} the graph component to select within the graph.
  */
  selectGraphic: function(graphic) {
    if(!graphic.get('selected')) {
      graphic.set('selected', true);
    }
    if(this.selectMultiple) {
      this.get('selected').pushObject(graphic);
    } else {
      var current = this.get('selected');
      if(current && current !== graphic) {
        current.set('selected', false);
      }
      this.set('selected', graphic);
    }
  },

  /**
    deselects the graphic passed.
    @method deselectGraphic
    @param graphic {Ember.Component} the graph child component to deselect.
  */
  deselectGraphic: function(graphic) {
    graphic.set('selected', false);
    if(this.selectMultiple) {
      this.get('selected').removeObject(graphic);
    } else {
      var current = this.get('selected');
      if(current && current === graphic) {
        this.set('selected', null);
      }
    }
  },

  /**
    The initialization method. Fired on `init`.
    @method _setup
    @private
  */
  _setup: function(){
    this.set('graphics', []);
    this.set('selected', this.selectMultiple ? [] : null);
  }.on('init'),

  /**
    Builds an action context to send to the controller.
    @method createActionContext
    @param x Domain value x
    @param y Domain value y
    @param source {Ember.Component} the component that is firing the event
    @param data {Object} item data for the event.
    @return {utils.nf.graph-action-context} a context to send with `sendAction`
    @private
  */
  createActionContext: function(x, y, source, data){
    return GraphActionContext.create({
      x: x,
      y: y,
      graph: this,
      source: source,
      data: data,
    });
  },
});

import Ember from 'ember';
import parsePropertyExpr from '../utils/parse-property-expression';
import { nearestIndexTo } from '../utils/nf/array-helpers';

var noop = function(){};

/**
  This is mixed in to {{#crossLink components.nf-graph}}nf-graph{{/crossLink}} child components that need to register data
  with the graph. Includes methods for extracting, sorting and scrubbing data
  for use in graphing components.

  Requires {{#crossLink "mixins.graph-registered-graphic"}}{{/crossLink}} and 
  {{#crossLink "mixins.graph-has-graph-parent"}}{{/crossLink}}

  @namespace mixins
  @class graph-data-graphic
  @extends Ember.Mixin
*/
export default Ember.Mixin.create({
	isDataGraphic: true,

  /**
    Gets or sets the data used by the component to plot itself.

    @property data
    @type Array
    @default null
  */
  data: null,

  /**
    The path of the property on each object in 
    {{#crossLink "mixins.graph-data-graphic/data:property"}}{{/crossLink}}
    to use as x data to plot on the graph.

    @property x
    @type String
    @default 'x'
  */
	xprop: 'x',

  /**
    The path of the property on each object in 
    {{#crossLink "mixins.graph-data-graphic/data:property"}}{{/crossLink}}
    to use as y data to plot on the graph.

    @property y
    @type String
    @default 'y'
  */
	yprop: 'y',

  /**
    The function to get the x value from each 
    {{#crossLink "mixins.graph-data-graphic/data:property"}}{{/crossLink}} object

    @property xPropFn
    @type Function
    @readonly
  */
	xPropFn: function() {
    var xprop = this.get('xprop');
		return xprop ? parsePropertyExpr(xprop) : noop;
	}.property('xprop'),

  /**
    The function to get the y value from each 
    {{#crossLink "mixins.graph-data-graphic/data:property"}}{{/crossLink}} object

    @property yPropFn
    @type Function
    @readonly
  */
	yPropFn: function() {
    var yprop = this.get('yprop');
		return yprop ? parsePropertyExpr(yprop) : noop;
	}.property('yprop'),

  /**
    Gets the x values from the `sortedData`.
    @property xData
    @type Array
    @readonly
  */
  xData: null,

  /**
    Gets the y values from the `sortedData`
    @property yData
    @type Array
    @readonly
  */
  yData: null,

  /**
    The sorted and mapped data pulled from {{#crossLink "mixins.graph-data-graphic/data:property"}}{{/crossLink}}
    An array of arrays, structures as so:

          [[x,y],[x,y],[x,y]];

    ** each inner array also has a property `data` on it, containing the original data object **

    When this property is computed, it also updates the `xData` and `yData` properties of the graphic.
    @property sortedData
    @type Array
    @readonly
  */
	sortedData: function(){
    var data = this.get('data');
    var xPropFn = this.get('xPropFn');
    var yPropFn = this.get('yPropFn');
    var xScaleType = this.get('xScaleType');

    if(!data) {
      return null;
    }

    var mapped = data.map(function(d, i) {
      var item = [xPropFn(d), yPropFn(d)];
    	item.data = d;
    	item.origIndex = i;
    	return item;
    });

    if(xScaleType !== 'ordinal') {
      mapped.sort(function(a, b) {
      	var ax = a[0];
        var bx = b[0];
        return ax === bx ? 0 : (ax > bx) ? 1 : -1;
      });
    }

    var xData = [];
    var yData = [];
    
    mapped.forEach(function(d) {
      xData.push(d[0]);
      yData.push(d[1]);
    });

    this.set('xData', xData);
    this.set('yData', yData);
    
    return mapped;
  }.property('data.@each', 'xPropFn', 'yPropFn'),

  /**
    The list of data points from {{#crossLink "mixins.graph-data-graphc/sortedData:property"}}{{/crossLink}} that
    fits within the x domain, plus up to one data point outside of that domain in each direction.
    @property renderedData
    @type Array
    @readonly
  */
  renderedData: function(){
    var sortedData = this.get('sortedData');
    var graph = this.get('graph');
    var xScaleType = graph.get('xScaleType');
    var xMin = graph.get('xMin');
    var xMax = graph.get('xMax');

    if(!sortedData || sortedData.length === 0) {
      return [];
    }

    if(xScaleType === 'ordinal') {
      return sortedData.slice();
    }

    return sortedData.filter(function(d, i) {
      var x = d[0];
      var prev = sortedData[i-1];
      var next = sortedData[i+1];
      var prevX = prev ? prev[0] : null;
      var nextX = next ? next[0] : null;

      return between(x, xMin, xMax) || between(prevX, xMin, xMax) || between(nextX, xMin, xMax);
    });
  }.property('sortedData.@each', 'graph.xScaleType', 'graph.xMin', 'graph.xMax'),

  /**
    The first element from {{#crossLink "mixins.graph-data-graphic/renderedData:property"}}{{/crossLink}}
    that is actually visible within the x domain.
    @property firstSortedData
    @type Array
    @readonly
  */
  firstVisibleData: function() {
    var renderedData = this.get('renderedData');
    var xMin = this.get('xMin');
    var first = renderedData[0];
    if(first && xMin > first[0] && renderedData.length > 1) {
      first = renderedData[1];
    }
    return first ? {
      x: first[0],
      y: first[1],
      data: first.data,
    } : null;
  }.property('renderedData.@each', 'xMin'),


  /**
    The last element from {{#crossLink "mixins.graph-data-graphic/renderedData:property"}}{{/crossLink}}
    that is actually visible within the x domain.
    @property lastVisibleData
    @type Array
    @readonly
  */
  lastVisibleData: function(){
    var renderedData = this.get('renderedData');
    var xMax = this.get('xMax');
    var last = renderedData[renderedData.length - 1];
    if(last && xMax < last[0] && renderedData.length > 1) {
      last = renderedData[renderedData.length - 2];
    }
    return last ? {
      x: last[0],
      y: last[1],
      data: last.data,
    }: null;
  }.property('renderedData.@each', 'xMax'),

  getDataNearXRange: function(rangeX) {
    var xScale = this.get('xScale');
    var isLinear = xScale && xScale.invert;
    if(isLinear) {
      return this.getDataNearX(xScale.invert(rangeX));
    } else {
      //ordinal
      var range = this.get('graph.xRange');
      var v = Math.abs(rangeX - range[0]) / Math.abs(range[1] - range[0]);
      var renderedData = this.get('renderedData');
      var i = Math.floor(v * renderedData.length);
      return renderedData[i];
    }
  },

  getDataNearX: function(x) {
    x = +x;
    if(x === x) {
      var renderedData = this.get('renderedData');
      var index = nearestIndexTo(renderedData, x, function(d){
        return d ? d[0] : null;
      });
      return index !== -1 ? renderedData[index] : null;
    }
  },
});

function between(x, a, b) {
  return a <= x && x <= b;
}
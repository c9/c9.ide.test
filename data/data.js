/**
 * Data base class for the Cloud9 Debugger.
 * @class debugger.Data
 */
/**
 * Retrieves an XML representation of this object.
 * @property {String} xml
 */
/**
 * Retrieves a json representation of thie object.
 * @property {String} json
 */
/**
 * Returns a string representation of this object (similar to {@link #xml})
 * @method toString
 * @return {String}
 */
/**
 * Determines whether the passed object is logically an exact copy.
 * @method equals
 * @param {Object} object
 */
define(function(require, exports, module) {
    
    var Emitter = require("events").EventEmitter;
    
    function Data(props, sets, singletons) {
        this.$props = props || [];
        this.$sets = sets || [];
        this.$single = singletons || [];
        
        var _self = this;
        this.$props.concat(this.$sets).concat(this.$single).forEach(function(prop) {
            _self.__defineGetter__(prop, function(){ 
                return this.data[prop];
            });
            _self.__defineSetter__(prop, function(v) { 
                this.data[prop] = v;
            });
        });
    }
    Data.prototype = new Emitter();
    Data.prototype.__defineGetter__("json", function(){ 
        return this.data;
    });
    Data.prototype.__defineSetter__("json", function(v) { 
        this.data = v;
    });
    
    ["label", "status", "className", "isOpen", "noSelect", "$sorted"].forEach(function(prop) {
        Data.prototype.__defineGetter__(prop, function(){ 
            return this.data[prop];
        });
        Data.prototype.__defineSetter__(prop, function(v) { 
            if (prop == "isOpen" && window.z == 1 & !v && this.data.label == "plugins/c9.analytics/analytics_test.js") debugger;
            this.data[prop] = v;
        });
    });

    module.exports = Data;
    
});
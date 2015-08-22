// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Test(options) {
        this.data = options || {};
        if (!this.data.type)
            this.data.type = "test";
    }
    
    Test.prototype = new Data(
        ["passed", "type", "output", "kind", "skip"],
        ["annotations"],
        ["pos", "selpos"]
    );
    
    Test.prototype.equals = function(frame) {
        return this.data.label == frame.label;
    };
    
    Test.prototype.clone = function(){
        var clone = new Test();
        for (var prop in this.data) {
            clone.data[prop] = this.data[prop];
        }
        return clone;
    }
    
    module.exports = Test;
});
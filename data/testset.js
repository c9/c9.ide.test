// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function TestSet(options) {
        this.data = options || {};
        if (!this.data.items)
            this.data.items = [];
        this.type = "testset";
    }
    
    TestSet.prototype = new Data(
        ["passed"], 
        ["items"],
        ["pos", "selpos"]
    );
    
    TestSet.prototype.equals = function(frame) {
        return this.data.label == frame.label;
    };
    
    TestSet.prototype.clone = function(){
        var clone = new TestSet();
        for (var prop in this.data) {
            clone.data[prop] = this.data[prop];
        }
        return clone;
    }
    
    module.exports = TestSet;
});
// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function File(options) {
        this.data = options || {};
        if (!this.data.items)
            this.data.items = [];
        if (!this.data.status)
            this.data.status = "pending";
        this.type = "file";
    }
    
    File.prototype = new Data(
        ["path", "coverage", "passed", "fullOutput", "output", "ownPassed"], 
        ["items"]
    );
    
    File.prototype.__defineGetter__("passed", function(){ 
        return typeof this.data.ownPassed == "number"
            ? this.data.ownPassed
            : this.data.passed;
    });
    
    File.prototype.equals = function(file) {
        return this.data.label == file.label;
    };
    
    File.prototype.clone = function(){
        var clone = new File();
        for (var prop in this.data) {
            clone.data[prop] = this.data[prop];
        }
        return clone;
    }
    
    module.exports = File;
});
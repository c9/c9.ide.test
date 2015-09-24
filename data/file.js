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
        this.keepChildren = true;
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
    
    File.prototype.addTest = function(def) {
        var test = Data.fromJSON([def])[0];
        this.data.items.push(test);
        return test;
    };
    
    module.exports = File;
});
// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Node(options) {
        this.data = options || {};
        if (!this.data.items)
            this.data.items = [];
        if (!this.data.type)
            this.data.type = "node";
    }
    
    Node.prototype = new Data(
        ["passed", "type", "runner", "index", "tree"], 
        ["items"]
    );
    
    Node.prototype.equals = function(node) {
        return this.data.label == node.label;
    };
    
    // Node.prototype.clone = function(){
    //     var clone = new Node();
    //     for (var prop in this.data) {
    //         clone.data[prop] = this.data[prop];
    //     }
    //     return clone;
    // }
    
    module.exports = Node;
});
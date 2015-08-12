define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "test", "ui"
    ];
    main.provides = ["test.codecoverage"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var test = imports.test;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        function load() {
            test.on("draw", function(){
                var toolbar = test.getElement("toolbar");
                
                ui.insertByIndex(toolbar, new ui.button({
                    caption: "Code Coverage",
                    skinset: "default",
                    skin: "c9-menu-btn"
                }), 100, plugin);
            });
        }
        
        /***** Methods *****/
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
        });
        
        /***** Register and define API *****/
        
        /**
         * This is an example of an implementation of a plugin. Check out [the source](source/template.html)
         * for more information.
         * 
         * @class Template
         * @extends Plugin
         * @singleton
         */
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "test.codecoverage": plugin
        });
    }
});
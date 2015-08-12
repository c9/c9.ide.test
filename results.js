define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings"
    ];
    main.provides = ["test.all"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var ui = imports.ui;
        var Tree = imports.Tree;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "Test Results",
            index: 100,
            height: 150
        });
        var emit = plugin.getEmitter();
        
        function load() {
            // plugin.setCommand({
            //     name: "test",
            //     hint: "search for a command and execute it",
            //     bindKey: { mac: "Command-.", win: "Ctrl-." }
            // });
            
            // panels.on("afterAnimate", function(){
            //     if (panels.isActive("commands.panel"))
            //         tree && tree.resize();
            // });
            
            // Menus
            // menus.addItemByPath("Run/Test", new ui.item({ 
            //     command: "commands" 
            // }), 250, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            opts.html.innerHTML = "Hello World";
            
        }
        
        /***** Methods *****/
        
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("show", function(e) {
            // txtFilter.focus();
            // txtFilter.select();
        });
        plugin.on("hide", function(e) {
            // Cancel Preview
            // tabs.preview({ cancel: true });
        });
        plugin.on("unload", function(){
            drawn = false;
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
            /**
             * @property {Object}  The tree implementation
             * @private
             */
            // get tree() { return tree; }
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});
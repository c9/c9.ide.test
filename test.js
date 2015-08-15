define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "settings", "panels", "menus"
    ];
    main.provides = ["test"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var settings = imports.settings;
        var panels = imports.panels;
        var menus = imports.menus;
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 400,
            caption: "Test",
            minWidth: 150,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var runners = [];
        var toolbar, container;
        
        function load() {
            // plugin.setCommand({
            //     name: "test",
            //     hint: "search for a command and execute it",
            //     bindKey: { mac: "Command-.", win: "Ctrl-." }
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
            
            // Splitbox
            var vbox = opts.aml.appendChild(new ui.vbox({ 
                anchors: "0 0 0 0" 
            }));
            
            // Toolbar
            toolbar = vbox.appendChild(new ui.bar({
                id: "toolbar",
                skin: "toolbar-top",
                class: "fakehbox aligncenter debugger_buttons basic",
                style: "white-space:nowrap !important"
            }));
            plugin.addElement(toolbar);
            
            ui.insertByIndex(toolbar, new ui.button({
                caption: "Run Test",
                skinset: "default",
                skin: "c9-menu-btn"
            }), 100, plugin);
            
            ui.insertByIndex(toolbar, new ui.button({
                caption: "Run All",
                skinset: "default",
                skin: "c9-menu-btn"
            }), 100, plugin);
            
            // Container
            container = vbox.appendChild(new ui.bar({
                style: "flex:1;-webkit-flex:1;display:flex;flex-direction: column;"
            }));
            
            emit.sticky("drawPanels", { html: container.$int, aml: container });
        }
        
        /***** Methods *****/
        
        function register(runner){
            runners.push(runner);
            
            emit("register", { runner: runner });
        }
        
        function unregister(runner){
            runners.splice(runners.indexOf(runner), 1);
            
            emit("unregister", { runner: runner });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("show", function(e) {
            
        });
        plugin.on("hide", function(e) {
            
        });
        plugin.on("unload", function() {
            drawn = false;
            toolbar = null;
            container = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            get runners(){ return runners; },
            
            /**
             * 
             */
            register: register,
            
            /**
             * 
             */
            unregister: unregister,
        });
        
        register(null, {
            test: plugin
        });
    }
});
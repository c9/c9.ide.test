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
        
        /*
            TODO:
            - Test results view
            
            - skip test (temporary exclusion)
            - remote test (permanent exclusion)
            - Run All button
            - Better icons
            - Toggle run button / stop
            - clear all previous states of list before running any
            - Hide Remote when it's not used
            - Error state for failed tests
            - Mocha: other test formats (not bdd)
            - Space bar should open specific test in file
            - While navigating the tree, scroll to the selected test if test file is active or on space bar
                Use `node.getPos()` or `b.something.getPos()`
                Note that https://github.com/c9/newclient/blob/master/plugins/c9.ide.language/outline.js#L550 can scroll to a definition using a starting and ending line, trying to scroll in such a way that both of them are visible.
            - Address anomaly for writer-test not being able to execute single test
            - Fix border (move to theme) of results
            - Fix: closed tree nodes don't have .parent set
            
            - View test results in ace
            - View log in viewer
            
            - Code coverage panel
            - View code coverage in ace
            
            - Triggers for running tests (based on code coverage)
            
            - Parallel test execution
            
            - Different row heights:
            https://github.com/c9/newclient/blob/master/node_modules/ace_tree/lib/ace_tree/data_provider.js#L392
            
            - Update Tree documentation:
                - Expand/Collapse using .isOpen = true/false + tree.refresh
                - Partial loading using status = potential + loadChildren
                - use of scrollMargin
        */
        
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
            
            // Container
            container = vbox.appendChild(new ui.bar({
                style: "flex:1;-webkit-flex:1;display:flex;flex-direction: column;"
            }));
            
            emit.sticky("drawPanels", { html: container.$int, aml: container });
        }
        
        /***** Methods *****/
        
        function registerTestRunner(runner){
            runners.push(runner);
            
            emit("register", { runner: runner });
        }
        
        function unregisterTestRunner(runner){
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
            register: registerTestRunner,
            
            /**
             * 
             */
            unregister: unregisterTestRunner,
        });
        
        register(null, {
            test: plugin
        });
    }
});
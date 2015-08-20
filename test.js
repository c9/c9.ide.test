define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "settings", "panels", "menus", "commands", "Menu", 
        "MenuItem", "Divider"
    ];
    main.provides = ["test"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var settings = imports.settings;
        var panels = imports.panels;
        var menus = imports.menus;
        var commands = imports.commands;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        
        /*
            TODO:
            
            RESULTS VIEW
                - Run tests from results
                    - use event in all to update loading state
                    - gather set of tests and find them in all and send to run (either full test set or individuals)
                - Add stop() method
            LATER:
                - Fix border (move to theme) of results
                - Focus a tree when panel gets focussed (last one)
            
            ALL VIEW
                - Update outline when typing in file that has outline open in all view
                - skip test (temporary exclusion)
                - remove test (permanent exclusion)
                - Error state for failed tests
                    - Timed out tests
                    - Broken mid-run
                    - Terminated (stop button)
                - Add split button back
                    - Add menu and allow runners to give settings in form format
                    - Pass settings to run()
            LATER: 
                - Better icons
                - Icons for play/stop button
                - Parallel test execution
            
            COVERAGE
                - When to clear coverage?
            LATER:
                - Clear all coverage from subnodes
            ISSUES:
                - AssertError is on the wrong line
                - Clear coverage on re-execution without coverage
            
            - Different row heights:
            https://github.com/c9/newclient/blob/master/node_modules/ace_tree/lib/ace_tree/data_provider.js#L392
            
            TWO EDITORS:
            - View log in viewer
            - Code coverage panel
            
            STATE
            - Keep coverage filename in state
            - Should test results be kept in state?
            - Should test output be kept in state?
            
            MOCHA
            - Add setting for debug mode
            - other test formats (not bdd)
            - Address anomaly for writer-test not being able to execute single test
                    - It appears to be a variable in a test/describe definition. This should be marked as unparseable.
            
            - Update Tree documentation:
                - Expand/Collapse using .isOpen = true/false + tree.refresh
                - Partial loading using status = potential + loadChildren
                - use of scrollMargin
            
            BUGS:
            - tab.once("activate", function(){ setTimeout(function(){ decorateFile(tab); }); });
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
        var toolbar, container, btnRun, btnClear, focussedPanel;
        var mnuSettings, btnSettings;
        
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
            
            commands.addCommand({
                name: "runtest",
                hint: "runs the selected test(s) in the test panel",
                bindKey: { mac: "F6", win: "F6" },
                group: "Test",
                exec: function(editor, args){
                    if (settings.getBool("user/test/coverage/@alwayson"))
                        return commands.exec("runtestwithcoverage", editor, args);
                    
                    transformRunButton("stop");
                    focussedPanel.run(args.nodes || null, function(err){
                        if (err) console.log(err);
                        transformRunButton("run");
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "runtestwithcoverage",
                hint: "runs the selected test(s) in the test panel with code coverage enabled",
                bindKey: { mac: "Shift-F6", win: "Shift-F6" },
                group: "Test",
                exec: function(editor, args){
                    transformRunButton("stop");
                    focussedPanel.run(args.nodes || null, { 
                        withCodeCoverage: true 
                    }, function(err, nodes){
                        transformRunButton("run");
                        if (err) return console.log(err);
                        
                        if (nodes) {
                            nodes.forEach(function(node){
                                if (node.coverage)
                                    emit("coverage", { node: node });
                            });
                        }
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "stoptest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(editor, args){
                    focussedPanel.stop(function(err){});
                }
            }, plugin);
            
            commands.addCommand({
                name: "cleartestresults",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    emit("clear");
                }
            }, plugin);
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
                style: "white-space:nowrap !important; height:32px;"
            }));
            plugin.addElement(toolbar);
            
            // Buttons
            btnRun = ui.insertByIndex(toolbar, new ui.button({
                caption: "Run Tests",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "runtest"
            }), 100, plugin);
            
            btnClear = ui.insertByIndex(toolbar, new ui.button({
                caption: "Clear",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "cleartestresults"
            }), 100, plugin);
            
            mnuSettings = new Menu({ items: [
                
            ]}, plugin);
            
            btnSettings = opts.aml.appendChild(new ui.button({
                skin: "header-btn",
                class: "panel-settings",
                style: "top:46px",
                submenu: mnuSettings.aml
            }));
            
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
        
        function transformRunButton(type){
            btnRun.setCaption(type == "stop" ? "Stop" : "Run Tests");
            btnRun.setAttribute("command", type == "stop" ? "stoptest" : "runtest");
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
            get settingsMenu(){ return mnuSettings; },
            
            /**
             * 
             */
            get focussedPanel(){ return focussedPanel; },
            set focussedPanel(v){ focussedPanel = v; },
            
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
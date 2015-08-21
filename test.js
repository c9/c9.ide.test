define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "settings", "panels", "menus", "commands", "Menu", 
        "MenuItem", "Divider", "tabManager"
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
        var tabManager = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        
        var Coverage = require("./data/coverage");
        var File = require("./data/file");
        var TestSet = require("./data/testset");
        var Test = require("./data/test");
        var Node = require("./data/node");
        
        /*
            TODO:
            
            RESULTS VIEW
                - Run tests from results
                    - use event in all to update loading state
                    - gather set of tests and find them in all and send to run (either full test set or individuals)
                - Add stop() method
            LATER:
                - Fix border (move to theme) of results
            
            REFACTOR TO USE DATA OBJECTS
                    - Start using data objects (emitter based, tree walker to find certain node types)
                    - Implement change event and create updateOutline
                    - Instead of .stackTrace do .annotations = {<linenr>: <message>}
                - Update outline when typing in file that has outline open in all view
                
            ALL VIEW
                - skip test (temporary exclusion)
                - remove test (permanent exclusion)
                - Error state for failed tests
                    - Timed out tests
                    - Broken mid-run
                    - Terminated (stop button)
                
                - Tests should be able to run without test panel open
                    - Test panel shouldnt open when running tests
                - Deal with content overflow of inline widgets
                - Add split button back
                    - Add menu and allow runners to give settings in form format
                    - Pass settings to run()
            LATER: 
                - Better icons
                - Icons for play/stop button
                - Parallel test execution
            
            COVERAGE
                - When code is run with coverage on, on save run with coverage again
                - Don't clear file->test information
            LATER:
                - Clear all coverage from subnodes
            ISSUES:
                - Clear coverage on re-execution without coverage
            
            STATE
            - Keep coverage data filename in state
            - Keep coverage totals in state (trigger "update" event)
            - Should test results be kept in state?
            - Should test output be kept in state?
            
            ACE
            - Coverage
                - Move gutterDecorations and markers when typing
                - Mark changed lines as yellow
                - Update coverage when typing
            - Horizontal scrolling with line widgets
            - Make line widgets an ace plugin
            - Fix ace-tree height issue of results
            - [Not Needed] Different row heights:
            https://github.com/c9/newclient/blob/master/node_modules/ace_tree/lib/ace_tree/data_provider.js#L392
            
            MOCHA
            - Add configure settings for loading files
            - Add setting for debug mode
            - other test formats (not bdd)
            - Address anomaly for writer-test not being able to execute single test
                    - It appears to be a variable in a test/describe definition. This should be marked as unparseable.
            
            *** LATER ***
            
            CODE COVERAGE PANEL
                - Add toolbar with dropdown to select to view coverage of only 1 test (or test type)
                - Expand methods in the tree and calculate coverage per method
            
            RAW LOG OUTPUT VIEWER
            - stream log output
            
            DOCS:
            - Update Tree documentation:
                - Expand/Collapse using .isOpen = true/false + tree.refresh
                - Partial loading using status = potential + loadChildren
                - use of scrollMargin
                - afterChoose is not documented (it says choose event)
            
            BUGS:
            - tab.once("activate", function(){ setTimeout(function(){ decorateFile(tab); }); });
            - in Editor: e.htmlNode is inconsistent e.html, e.aml is consistent
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
            
            commands.addCommand({
                name: "opentestoutput",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    focussedPanel.tree.selectedNodes.forEach(function(n){
                        var output = (findFileNode(n) || 0).fullOutput;
                        if (!output) return;
                        
                        tabManager.open({
                            editorType: "ace",
                            focus: true,
                            document: {
                                title: "Raw Test Output"
                            },
                            value: output
                        }, function(){});
                    });
                },
                isAvailable: function(){
                    return focussedPanel.tree.selectedNodes.some(function(n){
                        return (findFileNode(n) || 0).fullOutput || false;
                    });
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
        
        function findFileNode(node){
            while (node.type != "file") node = node.parent;
            return node;
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
            Coverage: Coverage,
            File: File,
            TestSet: TestSet,
            Test: Test,
            Node: Node,
            
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
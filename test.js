define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "settings", "panels", "menus", "commands", "Menu", 
        "MenuItem", "Divider", "tabManager", "fs", "dialog.error"
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
        var fs = imports.fs;
        var showError = imports["dialog.error"].show;
        
        var Coverage = require("./data/coverage");
        var File = require("./data/file");
        var TestSet = require("./data/testset");
        var Test = require("./data/test");
        var Node = require("./data/node");
        var Data = require("./data/data");
        
        // Destructive conversion process
        Data.fromJSON = function(list){
            return list.map(function(node){
                if (node.items) node.items = Data.fromJSON(node.items);
                return node.type == "testset" ? new TestSet(node) : new Test(node);
            });
        };
        
        /*
            TODO:
            
            SALESFORCE PLUGIN
                * stacktrace parsing need to find entry that is not top one
                    * make stack paths links 
                    * make links clickable (css + action)
                - filtering can filter beyond files. This shouldn't be possible
                - Filtering is not working after first filter
                - Raw Test is empty (not even ace) after refresh
                
                - Parallel test execution
                - Allow plugin to set global coverage
                - [Can't Reproduce] Clear is broken
            
            BUGS
            - mocha fetch is too slow and is called too often
            - resize issues
                - results size (also needs 1px extra height @nightwing thoughts?)
            - output from mocha can come in differently combined chunks, 
                sometimes there is output from several test in one chunk
                sometimes only half of output, ending in the middle of stacktrace
                for combined output mocha only shows results of the first test
            - global coverage marker is too large in dark theme
            - Add timeout to stop button, forcing stopped state
                
            ACE (Harutyun)
            - Coverage
                - Move gutterDecorations and markers when typing
                - Mark changed lines as yellow
            - Fix ace-tree height issue of results
            - Increase gutter to make room for both code coverage markings and fold widgets
            
            MOCHA
            - Address anomaly for writer-test not being able to execute single test
                    - It appears to be a variable in a test/describe definition. This should be marked as unparseable.
            
            TESTS
            - Manually: One problem with test panel is that it can throw errors 
                in save and tab open listeners, breaking rest of the ide
                we need to carefully review this parts before merging
            - Write tests for at least mocha.js plugin
                - Error state for failed tests
                    - Error before test is started isn't shown
                    - Stack trace before test is started isn't shown
                    - Timed out tests
                    - Broken mid-run
                    - Terminated (stop button)
                    - Test file is only executed when it has parsed tests
                    - Syntax errors causing 0 tests to be found by outline
                    - replace test file with a single character < (trying syntax error scenario)
                    - Mocha not installed:
                        - Raw output shows (nothing in file): execvp(3) failed.: No such file or directory
                    - Test same for istanbul not installed
            
            *** LATER ***
            
            ALL VIEW
                - Better icons
                - Maybe: Icons for play/stop button
                - When writing in a certain test, invalidate those resuls
                    - On save, only execute those tests that are changed
                - Support favorite test files on demand (when they are opened)
            
            MOCHA
            - other test formats (not bdd)
            
            REFACTOR TO USE DATA OBJECTS
                - Listen:
                    - rename a file | Mocha is doing this itself by refetching. is that optimal?
                    - delete a file | Mocha is doing this itself by refetching. is that optimal?
            
            CODE COVERAGE PANEL
                - Add toolbar with dropdown to select to view coverage of only 1 test (or test type)
                - Expand methods in the tree and calculate coverage per method
            
            RAW LOG OUTPUT VIEWER
            - stream log output
            
            COVERAGE
            - Clear all coverage from subnodes (might not be relevant anymore)
            
            OPTIMIZATIONS
            - Should test results be kept in state?
            - Should test output be kept in state?
            
            ACE
            - Make line annotation an ace plugin
            
            DOCS:
            - Update Tree documentation:
                - Expand/Collapse using .isOpen = true/false + tree.refresh
                - Partial loading using status = potential + loadChildren
                - use of scrollMargin
                - afterChoose is not documented (it says choose event)
            
            BUGS:
            - Running closed items in result window will close them again. they should stay open
            - result window loses focus when running
            -----
            - normal outline has wrong color on selection (of filtered text)
            - test outline should highlight filtered text
            - duplicate favorite gives an error
            - tab.once("activate", function(){ setTimeout(function(){ decorateFile(tab); }); });
            - in Editor: e.htmlNode is inconsistent e.html, e.aml is consistent
            - run test button doesn't work if test panel.draw wasn't called
            - [Can't reproduce] when filtering the client-config test cannot be found
            - [Can't reproduce] when filtering too early, filtering yield no results
            - [Can't reproduce] results window throws error when loop cannot find parents (line 385)
            - Move rowheight change code to widget?
        */
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 400,
            caption: "Test",
            minWidth: 150,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var configPath = options.configPath || "/.c9/test.settings.yml";
        var config, ready;
        
        var runners = [];
        var toolbar, container, btnRun, focussedPanel, mnuRun, mnuSettings;
        var lastTest;
        
        function load() {
            // plugin.setCommand({
            //     name: "test",
            //     hint: "search for a command and execute it",
            //     bindKey: { mac: "Command-.", win: "Ctrl-." }
            // });
            
            commands.addCommand({
                name: "runtest",
                hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "F6", win: "Ctrl-F5" },
                group: "Test",
                exec: function(editor, args){
                    if (settings.getBool("user/test/coverage/@alwayson"))
                        return commands.exec("runtestwithcoverage", editor, args);
                    
                    transformRunButton("stop");
                    focussedPanel.run(args.nodes || null, {
                        transformRun: args.transformRun
                    }, function(err, nodes){
                        transformRunButton("run");
                        if (err) return console.log(err);
                        
                        if (nodes) {
                            nodes.forEach(function(node){
                                emit(node.coverage
                                    ? "coverage"
                                    : "clearCoverage", { node: node });
                            });
                        }
                    });
                }
            }, plugin);

            commands.addCommand({
                name: "runfocussedtest",
                hint: "runs the focussed test or last run test",
                bindKey: { mac: "F6", win: "Ctrl-F5" },
                group: "Test",
                exec: function(editor, args){
                    var path = tabManager.focussedTab.path;
                    var test = focussedPanel.findFileByPath(path);
                    return commands.exec("runtest", editor, { 
                        nodes: test ? [test] : lastTest,
                        transformRun: true
                    });
                },
                isAvailable: function(){
                    var path = (tabManager.focussedTab || 0).path;
                    return focussedPanel.findFileByPath(path) || lastTest ? true : false;
                }
            }, plugin);

            commands.addCommand({
                name: "runfocussedtestwithcoverage",
                hint: "runs the focussed test or last run test with code coverage",
                bindKey: { mac: "Shift-F6", win: "Ctrl-Shift-F5" },
                group: "Test",
                exec: function(editor, args){
                    var path = tabManager.focussedTab.path;
                    var test = focussedPanel.findFileByPath(path);
                    return commands.exec("runtestwithcoverage", editor, { 
                        nodes: test ? [test] : lastTest,
                        transformRun: true
                    });
                },
                isAvailable: function(){
                    var path = (tabManager.focussedTab || 0).path;
                    return focussedPanel.findFileByPath(path) || lastTest ? true : false;
                }
            }, plugin);

            commands.addCommand({
                name: "runtestwithcoverage",
                hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Shift-F6", win: "Ctrl-Shift-F5" },
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
                                emit(node.coverage
                                    ? "coverage"
                                    : "clearCoverage", { node: node });
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
                name: "skiptest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    focussedPanel.skip(function(err){});
                },
                isAvailable: function(){
                    return focussedPanel.tree 
                      && focussedPanel.tree.selectedNodes.some(function(n){
                        if (n.type == "file") return true;
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "removetest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    focussedPanel.remove(function(err){});
                },
                isAvailable: function(){
                    return focussedPanel.tree 
                      && focussedPanel.tree.selectedNodes.some(function(n){
                        if (n.type == "file") return true;
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "opentestoutput",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(args){
                    var nodes = args.nodes || focussedPanel.tree.selectedNodes;
                    nodes.forEach(function(n){
                        var output = (n.findFileNode() || 0).fullOutput;
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
                        return (n.findFileNode() || 0).fullOutput || false;
                    });
                }
            }, plugin);
            
            menus.addItemByPath("Cloud9/Open Your Test Configuration", new ui.item({
                onclick: openTestConfigFile
            }), 900, plugin);
            
            fs.readFile(configPath, function(err, data){
                if (err && err.code != "ENOENT")
                    return showError("Could not load " + configPath 
                        + ". The test panel is disabled. Please restart " 
                        + "Cloud9 to retry.");
                
                parse(data || "");
                
                // TODO add watcher for the config
                
                ready = true;
                emit.sticky("ready");
            });
        }
        
        var drawnMenu = false;
        function drawMenu(){
            if (drawnMenu) return;
            drawnMenu = true;
            
            menus.addItemByPath("Run/Run Test", new ui.item({
                command: "runfocussedtest"
            }), 1250, plugin);
            menus.addItemByPath("Run/Run Test with Code Coverage", new ui.item({
                command: "runfocussedtestwithcoverage"
            }), 1260, plugin);
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
            toolbar = vbox.appendChild(new ui.hbox({
                id: "toolbar",
                class: "toolbar-top",
                align: "center",
                edge: "0 2 0 0",
                // padding: 3
                // class: "fakehbox aligncenter debugger_buttons basic",
                // style: "white-space:nowrap !important;"
                style: "border-top:0"
            }));
            plugin.addElement(toolbar);
            
            // Run Menu
            var emptyLabel = new ui.label({ caption: "No Settings "});
            mnuRun = new ui.menu({});
            mnuRun.addEventListener("prop.visible", function(e){
                if (!e.value) return;
                
                var runners = [], found = {};
                
                for (var i = mnuRun.childNodes.length - 1; i >= 0; i--) {
                    mnuRun.removeChild(mnuRun.childNodes[i]);
                }
                
                if (focussedPanel.tree.selectedNode) {
                    focussedPanel.tree.selectedNodes.forEach(function(n){
                        if (n.type == "all" || n.type == "root" || n.type == "runner") {
                            n.findAllNodes("runner").forEach(function(n){
                                var runner = n.runner;
                                if (found[n.name]) return;
                                found[n.name] = true;
                                runners.push(runner);
                            });
                        }
                        else {
                            var runner = n.findRunner();
                            if (found[runner.name]) return;
                            found[runner.name] = true;
                            runners.push(runner);
                        }
                    });
                }
                
                if (!runners.length) {
                    mnuRun.appendChild(emptyLabel);
                    return;
                }
                
                runners.forEach(function(runner){
                    if (runner.form) {
                        if (!runner.meta.$label) {
                            runner.meta.$label = new ui.label({
                                caption: runner.root.label.toLowerCase(),
                                class: "runner-form-header"
                            });
                        }
                        mnuRun.appendChild(runner.meta.$label);
                        runner.form.attachTo(mnuRun);
                    }
                });
            });
            
            // Buttons
            btnRun = ui.insertByIndex(toolbar, new ui.splitbutton({
                caption: "Run Tests",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "runtest",
                submenu: mnuRun
            }), 100, plugin);
            
            ui.insertByIndex(toolbar, new ui.button({
                caption: "Clear",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "cleartestresults"
            }), 100, plugin);
            
            mnuSettings = new Menu({ items: [
                new MenuItem({ caption: "Refresh", onclick: refresh }),
                new Divider()
            ]}, plugin);
            
            opts.aml.appendChild(new ui.button({
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
            drawMenu();
            
            runners.push(runner);
            
            emit("register", { runner: runner });
        }
        
        function unregisterTestRunner(runner){
            runners.splice(runners.indexOf(runner), 1);
            
            emit("unregister", { runner: runner });
        }
        
        function transformRunButton(type){
            if (!drawn) return;
            btnRun.setAttribute("caption", type == "stop" ? "Stop" : "Run Tests");
            btnRun.setAttribute("command", type == "stop" ? "stoptest" : "runtest");
        }
        
        function parse(data){
            if (!config) config = {};
            
            var keepNewline, stack = [config], top = config, name, create;
                
            data.split("\n").forEach(function(rawLine){
                // line = line.trim();
                var line = rawLine.split("#")[0].trimRight();
                
                if (line.match(/^\s*([\w-_ ]*):(\s?[|>]?)$/)) {
                    // stack.pop(); top = stack[stack.length - 1];
                    top = config; // Fucks use of stack, but will fix later
                    
                    name = RegExp.$1;
                    create = true;
                    // keepNewline = RegExp.$2 == "|";  // Not used
                }
                else if (line.match(/^\s*- (.*)$/)) {
                    if (create) {
                        stack.push(top = top[name] = {});
                        create = false;
                    }
                    
                    top[RegExp.$1] = rawLine.replace(/^\s*- /, ""); // Not according to spec, but more useful
                }
                else if (line.match(/ {2}(.*)/)) {
                    if (create) {
                        top[name] = "";
                        stack.push(-1);
                        create = false;
                    }
                    
                    top[name] += RegExp.$1 += "\n";
                }
            });
            
            if (stack.pop() == -1) 
                top[name] = top[name].substr(0, top[name].length - 1); // Remove last \n of strings
            
            return config;
        }
        
        function saveConfig(callback){
            var contents = "";
            
            var item;
            for (var prop in config) {
                contents += prop + ":";
                
                item = config[prop];
                if (typeof item == "object") {
                    contents += "\n";
                    for (var name in item) {
                        contents += "  - " 
                          + (typeof item[name] == "string" ? item[name] : name)
                          + "\n";
                    }
                }
                else {
                    contents += " |\n";
                    contents += "  " + item.toString().split("\n").join("\n  ");
                }
                
                contents += "\n";
            }
            
            fs.writeFile(configPath, contents, callback);
            
            emit("updateConfig");
        }
        
        function refresh(){
            emit("update");
        }
        
        function openTestConfigFile(){
            tabManager.open({
                path: configPath,
                newOnError: true,
                value: "excluded:\n  - \n\nskipped:\n  - \n",
                focus: true
            }, function(){});
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
            drawnMenu = false;
            toolbar = null;
            container = null;
            config = null;
            ready = null;
            runners = [];
            btnRun = null;
            focussedPanel = null;
            mnuRun = null;
            mnuSettings = null;
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
            get ready(){ return ready; },
            
            /**
             * 
             */
            get config(){ return config; },
            
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
            get lastTest(){ return lastTest; },
            set lastTest(v){ lastTest = v; },
            
            /**
             * 
             */
            saveConfig: saveConfig,
            
            /**
             * 
             */
            refresh: refresh,
            
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
define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands"
    ];
    main.provides = ["test.all"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var Tree = imports.Tree;
        var commands = imports.commands;
        
        var async = require("async");

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "All Tests",
            index: 200,
            style: "flex:1;-webkit-flex:1"
        });
        var emit = plugin.getEmitter();
        
        var tree, wsNode, rmtNode, btnRun, btnRunAll, stopping;
        
        function load() {
            // plugin.setCommand({
            //     name: "test",
            //     hint: "search for a command and execute it",
            //     bindKey: { mac: "Command-.", win: "Ctrl-." }
            // });
            
            panels.on("afterAnimate", function(){
                if (panels.isActive("test"))
                    tree && tree.resize();
            });
            
            // Menus
            // menus.addItemByPath("Run/Test", new ui.item({ 
            //     command: "commands" 
            // }), 250, plugin);
            
            commands.addCommand({
                name: "runtest",
                hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    run();
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Buttons
            var toolbar = test.getElement("toolbar");
            
            btnRun = ui.insertByIndex(toolbar, new ui.button({
                caption: "Run Test",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "runtest"
            }), 100, plugin);
            
            btnRunAll = ui.insertByIndex(toolbar, new ui.button({
                caption: "Run All",
                skinset: "default",
                skin: "c9-menu-btn"
            }), 100, plugin);
            
            // Tree
            tree = new Tree({
                container: opts.html,
            
                getIconHTML: function(node) {
                    var icon = node.isFolder ? "folder" : "default";
                    if (node.status === "loading") icon = "loading";
                    return "<span class='ace_tree-icon " + icon + "'></span>";
                },
                
                getRowIndent: function(node) {
                    return node.$depth ? node.$depth - 1 : 0;
                }
            }, plugin);
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "10px";
            tree.container.style.top = "10px";
            tree.container.style.right = "10px";
            tree.container.style.bottom = "10px";
            tree.container.style.height = "";
            
            wsNode = {
                label: "workspace",
                isOpen: true,
                className: "heading",
                status: "loaded",
                noSelect: true,
                $sorted: true,
                
                items: []
            };
            rmtNode = {
                label: "remote",
                isOpen: true,
                className: "heading",
                status: "loaded",
                noSelect: true,
                $sorted: true,
                
                items: []
            };
            
            tree.setRoot({
                label: "root",
                items: [wsNode, rmtNode]
            });
            
            // Tree Events
            tree.on("expand", function(e){
                populate(e.node, function(err){
                    if (err) return console.error(err);
                });
            }, plugin);
            
            // Initiate test runners
            test.on("register", function(e){ init(e.runner) }, plugin);
            test.on("unregister", function(e){ deinit(e.runner) }, plugin);
            
            test.runners.forEach(init);
        }
        
        /***** Helper Methods *****/
        
        function populate(node, callback){
            var runner = findRunner(node);
                
            updateStatus(node, "loading");
            
            runner.populate(node, function(err){
                if (err) return callback(err); // TODO
                
                updateStatus(node, "loaded");
                
                callback();
            });
        }
        
        function findRunner(node){
            while (!node.runner) node = node._parent;
            return node;
        }
        
        function init(runner){
            var parent = runner.remote ? rmtNode : wsNode;
            parent.items.push(runner.root);
            
            updateStatus(runner.root, "loading");
            
            runner.init(runner.root, function(err){
                if (err) return console.error(err); // TODO
                
                updateStatus(runner.root, "loaded");
            });
        }
        
        function deinit(runner){
            if (runner.root._parent) {
                var items = runner.root._parent.items;
                items.splice(items.indexOf(runner.root), 1);
            }
            
            tree.refresh();
        }
        
        /***** Methods *****/
        
        function run(nodes, parallel, callback){
            if (typeof parallel == "function")
                callback = parallel, parallel = false;
            
            if (!nodes)
                nodes = tree.selection;
            
            if (parallel === undefined)
                parallel = settings.getBool("shared/test/@parallel"); // TODO have a setting per runner
            
            // TODO influence run button
                
            async[parallel ? "each" : "eachSeries"](nodes, function(node, callback){
                if (node.status != "loaded")
                    return populate(node, function(err){
                        if (err) return callback(err);
                        _run(node, callback);
                    });
                
                _run(node, callback);
            }, function(err){
                if (err) return callback(err);
                
                // TODO influence run button
                
                callback();
            });
        }
        
        function _run(node, callback){
            var runner = findRunner(node);
            
            updateStatus(node, "running");
            
            runner.run(node, function(chunk){
                emit("log", chunk);
            }, function(err, node){
                if (err) return callback(err);
                
                updateStatus(node, "loaded");
                
                callback();
            });
        }
        
        function updateStatus(node, s){
            node.status = s;
            
            while (node.type != "file")
                node.status = s, node = node._parent;
            
            tree.refresh();
        }
        
        function stop(){
            // TODO
            stopping = true;
        }
        
        // function applyFilter() {
        //     model.keyword = filterbox && filterbox.getValue();

        //     if (!model.keyword) {
        //         model.reKeyword = null;
        //         model.setRoot(model.cachedRoot);

        //         // model.isOpen = function(node){ return node.isOpen; }
        //     }
        //     else {
        //         model.reKeyword = new RegExp("("
        //             + util.escapeRegExp(model.keyword) + ")", 'i');
        //         var root = search.treeSearch(model.cachedRoot.items, model.keyword, true);
        //         model.setRoot(root);

        //         // model.isOpen = function(node){ return true; };
        //     }
        // }
        
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
            tree = null;
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
            get tree() { return tree; },
            
            /**
             * 
             */
            run: run
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});
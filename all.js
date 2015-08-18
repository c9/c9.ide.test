define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands", "test",
        "Menu", "MenuItem", "Divider", "tabManager"
    ];
    main.provides = ["test.all"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var Tree = imports.Tree;
        var test = imports.test;
        var commands = imports.commands;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var tabManager = imports.tabManager;
        
        var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "All Tests",
            index: 200,
            // showTitle: true,
            style: "flex:1;-webkit-flex:1"
        });
        var emit = plugin.getEmitter();
        
        var tree, wsNode, rmtNode, stopping, menuContext, running;
        
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
            
            test.focussedPanel = plugin;
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);
            
            // Tree
            tree = new Tree({
                container: opts.html,
                scrollMargin: [10, 0],
            
                getCaptionHTML: function(node) {
                   if (node.type == "file") {
                        var path = dirname(node.label);
                        return basename(path) + "/" + basename(node.label) 
                            + "<span class='extrainfo'> - " + dirname(path) + "</span>";
                   }
                   else if (node.type == "all") {
                       return escapeHTML(node.label) + " (" + node.items.length + ")";
                   }
                   else if (node.type == "describe") {
                       return "<span style='opacity:0.5;'>" + escapeHTML(node.label) + "</span>";
                   }
                   else if (node.kind == "it") {
                       return "it " + escapeHTML(node.label);
                   }
                   
                   return escapeHTML(node.label);
                },
            
                getIconHTML: function(node) {
                    var icon = "default";
                    
                    if (node.status === "loading") icon = "loading";
                    else if (node.status === "running") icon = "test-in-progress";
                    else if (node.passed === 1) icon = "test-passed";
                    else if (node.passed === 0) icon = "test-failed";
                    else if (node.passed === 2) icon = "test-error";
                    else if (node.passed === 3) icon = "test-terminated";
                    else if (node.passed === 4) icon = "test-ignored";
                    else if (node.type == "describe") icon = "folder";
                    else if (node.type == "test") icon = "test-notran";
                    
                    return "<span class='ace_tree-icon " + icon + "'></span>";
                },
                
                getClassName: function(node) {
                    return (node.className || "") 
                        + (node.status == "loading" ? " loading" : "")
                        + (node.status == "running" ? " loading" : ""); // TODO different running icon
                },
                
                getRowIndent: function(node) {
                    return node.$depth ? node.$depth - 1 : 0;
                },
                
                // Tree Events
                loadChildren: function(node, callback){
                    populate(node, callback);
                },
                
                // sort: function(children) {
                //     var compare = tree.model.alphanumCompare;
                //     return children.sort(function(a, b) {
                //         // TODO index sorting
                //         // if (aIsSpecial && bIsSpecial) return a.index - b.index; 
                
                //         return compare(a.name + "", b.name + "");
                //     });
                // }
            }, plugin);
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "10px";
            tree.container.style.top = "0";
            tree.container.style.right = "10px";
            tree.container.style.bottom = "0";
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
                items: [wsNode] //, rmtNode]
            });
            
            tree.commands.bindKey("Space", function(e) {
                openTestFile();
            });
            
            tree.commands.bindKey("Enter", function(e) {
                commands.exec("runtest");
            });
            
            tree.on("focus", function(){
                test.focussedPanel = plugin;
            });
            
            tree.on("select", function(){
                openTestFile([tree.selectedNode], true);
            });
            
            // Hook clear
            test.on("clear", function(){
                clear();
            }, plugin);
            
            // Menu
            menuContext = new Menu({ items: [
                new MenuItem({ command: "runtest", caption: "Run", class: "strong" }),
                new Divider(),
                new MenuItem({ caption: "Open Test File", onclick: openTestFile }),
                // new MenuItem({ caption: "Open Related Files", disabled: true }),
                new Divider(),
                new MenuItem({ caption: "Skip" }),
                new MenuItem({ caption: "Remove" })
            ] }, plugin);
            opts.aml.setAttribute("contextmenu", menuContext.aml);
            
            // Initiate test runners
            test.on("register", function(e){ init(e.runner) }, plugin);
            test.on("unregister", function(e){ deinit(e.runner) }, plugin);
            
            test.runners.forEach(init);
            tree.resize();
        }
        
        /***** Helper Methods *****/
        
        function populate(node, callback){
            var runner = findRunner(node);
            
            updateStatus(node, "loading");
            
            runner.populate(node, function(err){
                if (err) return callback(err); // TODO
                
                updateStatus(node, "loaded");
                fixParents(node);
                
                callback();
            });
        }
        
        function findRunner(node){
            while (!node.runner) node = node.parent;
            return node.runner;
        }
        
        function init(runner){
            var parent = runner.remote ? rmtNode : wsNode;
            parent.items.push(runner.root);
            
            updateStatus(runner.root, "loading");
            
            runner.init(runner.root, function(err){
                if (err) return console.error(err); // TODO
                
                tree.open(runner.root);
                updateStatus(runner.root, "loaded");
                
                fixParents(runner.root);
            });
        }
        
        function deinit(runner){
            if (runner.root.parent) {
                var items = runner.root.parent.items;
                items.splice(items.indexOf(runner.root), 1);
            }
            
            tree.refresh();
        }
        
        function findFileNode(node){
            while (node.type != "file") node = node.parent;
            return node;
        }
        
        // TODO export to ace editor and add loading detection
        function scrollToDefinition(ace, line, lineEnd) {
            var lineHeight = ace.renderer.$cursorLayer.config.lineHeight;
            var lineVisibleStart = ace.renderer.scrollTop / lineHeight;
            var linesVisible = ace.renderer.$size.height / lineHeight;
            lineEnd = Math.min(lineEnd, line + linesVisible);
            if (lineVisibleStart <= line && lineEnd <= lineVisibleStart + linesVisible)
                return;

            var SAFETY = 1.5;
            ace.scrollToLine(Math.round((line + lineEnd) / 2 - SAFETY), true);
        }
        
        function openTestFile(nodes, onlyWhenOpen){
            (nodes || tree.selectedNodes).forEach(function(n){
                if (n.type == "file") {
                    if (onlyWhenOpen && !tabManager.findTab(n.path))
                        return;
                    
                    tabManager.openFile(n.path, true, function(){});
                }
                else if (n.pos) {
                    var fileNode = findFileNode(n);
                    if (onlyWhenOpen && !tabManager.findTab(fileNode.path))
                        return;
                    
                    var pos = n.selpos || n.pos;
                    var select = n.selpos ? {
                        row: n.selpos.el,
                        column: n.selpos.ec
                    } : undefined;
                    
                    tabManager.open({
                        path: fileNode.path,
                        focus: false
                    }, function(err, tab){
                        var ace = tab.editor.ace;
                        
                        var scroll = function(){
                            ace.selection.clearSelection();
                            scrollToDefinition(ace, n.pos.sl, n.pos.el);
                            
                            ace.moveCursorTo(pos.sl - 1, pos.sc);
                            if (select)
                                ace.getSession().getSelection().selectToPosition({ row: pos.el - 1, column: pos.ec });
                        }
                        
                        if (ace.session.doc.$lines.length)
                            scroll();
                        else
                            ace.once("changeSession", scroll);
                    });
                }
            });
        }
        
        function fixParents(node){
            if (!node.items) return;
            
            node.items.forEach(function(n){
                if (!n.parent) n.parent = node;
                if (n.items) fixParents(n);
            });
        }
        
        /***** Methods *****/
        
        function run(nodes, parallel, callback){
            running = true;
            
            if (typeof parallel == "function")
                callback = parallel, parallel = false;
            
            if (!nodes)
                nodes = tree.selectedNodes;
            
            if (parallel === undefined)
                parallel = settings.getBool("shared/test/@parallel"); // TODO have a setting per runner
            
            var list = [];
            nodes.forEach(function(n){
                if (n.type == "all" || n.type == "root")
                    getAllNodes(n, "file").forEach(function(n){ list.push(n); });
                else
                    list.push(n);
            });
            
            // clear all previous states of list before running any
            clear();
            
            async[parallel ? "each" : "eachSeries"](list, function(node, callback){
                if (stopping) return callback(new Error("Terminated"));
                
                if (node.status == "pending") // TODO do this lazily
                    return populate(node, function(err){
                        if (err) return callback(err);
                        _run(node, callback);
                    });
                
                _run(node, callback);
            }, function(err){
                emit("stop");
                running = false;
                delete progress.stop;
                
                callback(err);
            });
        }
        
        var progress = {
            log: function(chunk){
                emit("log", chunk); console.log(chunk)
            },
            start: function(node){
                updateStatus(node, "running");
            },
            end: function(node){
                updateStatus(node, "loaded");
            }
        }
        
        function _run(node, callback){
            var runner = findRunner(node);
            
            updateStatus(node, "running");
            
            progress.stop = runner.run(node, progress, function(err){
                updateStatus(node, "loaded");
                emit("result", { node: node });
                
                callback(err)
            });
        }
        
        function getAllNodes(node, type){
            var nodes = [];
            (function recur(items){
                for (var j, i = 0; i < items.length; i++) {
                    j = items[i];
                    if (j.type.match(type)) nodes.push(j);
                    else if (j.items) recur(j.items);
                }
            })([node]);
            
            return nodes;
        }
        
        function updateStatus(node, s){
            // TODO make this more efficient by trusting the child nodes
            if (node.type == "file" || node.type == "describe") {
                var tests = getAllNodes(node, /test|prepare/);
                
                var st, p = [];
                tests.forEach(function(test){
                    if (st === undefined && test.status != "loaded")
                        st = test.status;
                    if (!p[test.passed]) p[test.passed] = 0;
                    p[test.passed]++;
                });
                
                node.passed = p[3] ? 3 : (p[2] ? 2 : p[0] ? 0 : (p[1] ? 1 : undefined));
                node.status = st || "loaded";
            }
            else if (node.type == "all" && node.type == "root") {
                tree.refresh();
                return;
            }
            else {
                node.status = s;
            }
            
            if (node.parent) updateStatus(node.parent, s);
            else tree.refresh();
        }
        
        function stop(callback){
            if (!running) return callback(new Error("Not Running"));
            
            stopping = true;
            plugin.once("stop", function(){
                stopping = false;
                callback();
            });
            
            if (progress.stop)
                progress.stop();
        }
        
        function clear(node){
            if (!node) 
                node = tree.root;
            
            node.items.forEach(function(n){
                delete n.passed;
                if (n.items) clear(n);
            });
            
            if (node == tree.root) 
                tree.refresh();
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
            run: run,
            
            /**
             * 
             */
            stop: stop,
            
            /**
             *
             */
            openTestFile: openTestFile
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});
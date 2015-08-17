define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands", "test.all",
        "util", "test"
    ];
    main.provides = ["test.results"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var util = imports.util;
        var Tree = imports.Tree;
        var test = imports.test;
        var commands = imports.commands;
        var all = imports["test.all"];
        
        var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "Test Results",
            index: 100,
            height: 150,
            style: "border-bottom:1px solid #DDD" // TODO
        });
        var emit = plugin.getEmitter();
        
        var tree, failNode, passNode, skipNode, errNode, rootNode, btnClear;
        var state = {};
        
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
                name: "cleartestresults",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    clear();
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            tree = new Tree({
                container: opts.html,
                maxLines: 50,
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
                   else if (node.type == "result") {
                       return escapeHTML(node.label) + " <span style='font-size:11px'>(" 
                            + node.items.length + ")</span>";
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
                    else if (node.passed === -1) icon = "test-ignored";
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
                }
                
                // // Tree Events
                // loadChildren: function(node, callback){
                //     populate(node, callback);
                // },
            }, plugin);
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "10px";
            tree.container.style.top = "0";
            tree.container.style.right = "10px";
            tree.container.style.bottom = "0";
            tree.container.style.height = "";
            
            failNode = {
                label: "failed",
                isOpen: true,
                passed: 0,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true,
                items: []
            };
            passNode = {
                label: "passed",
                isOpen: true,
                passed: 1,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true,
                items: []
            };
            skipNode = {
                label: "skipped",
                isOpen: true,
                passed: 4,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true,
                items: []
            };
            errNode = {
                label: "error",
                isOpen: true,
                passed: 2,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true,
                items: []
            };
            // rootNode = {
            //     label: "results",
            //     isOpen: true,
            //     className: "heading",
            //     status: "loaded",
            //     noSelect: true,
            //     $sorted: true,
                
            //     items: []
            // };
            
            tree.setRoot(rootNode = {
                label: "root",
                items: []
            });
            
            tree.commands.bindKey("Space", function(e) {
                openTestFile();
            });
            
            tree.commands.bindKey("Enter", function(e) {
                commands.exec("runtest");
            });
            
            tree.on("afterRender", recalc);
            
            // Toolbar Button
            var toolbar = test.getElement("toolbar");
            btnClear = ui.insertByIndex(toolbar, new ui.button({
                caption: "Clear Results",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "cleartestresults"
            }), 100, plugin);
            
            // Process Result
            var nodes = [failNode, passNode, errNode, null, skipNode];
            all.on("result", function(e){
                var results = [failNode.items, passNode.items, errNode.items, [], skipNode.items];
                importResultsToTree(e.node, results);
                
                var hasFail = results[0].length || results[1].length;
                
                rootNode.items.length = 0;
                [0,2,1,4].forEach(function(i){
                    if (results[i].length) {
                        rootNode.items.push(nodes[i]);
                        // if (i === 1 || i === 4)
                        //     nodes[i].isOpen = !hasFail;
                    }
                });
                
                if (rootNode.items.length)
                    plugin.show();
                    
                tree.refresh();
            }, plugin);
            
            plugin.hide();
        }
        
        /***** Methods *****/
        
        function clear(){
            plugin.hide();
            
            failNode.items.length = 0;
            passNode.items.length = 0;
            errNode.items.length = 0;
            skipNode.items.length = 0;
            
            state = {};
            tree.refresh();
            
            // all.clear();
        }
        
        function recalc() {
            var cells = tree.container.querySelector(".ace_tree_cells").lastChild;
            plugin.height = cells.scrollHeight + tree.container.parentNode.offsetTop + 20;
        }
        
        // Calculate the index of the 
        function calcIndex(group, node){
            var pitems = node.parent.items;
            var idx = pitems.indexOf(node);
            var pass = node.passed;
            // if (node.label.indexOf("without") > -1) debugger;
            var found = 0;
            for (var i = idx; i >= 0; i--) {
                if (pitems[i].passed != pass) continue;
                
                group.some(function(n, j){ 
                    if (n.label == pitems[i].label) {
                        found = j + 1;
                        return true; 
                    }
                });
                if (found) return found;
            }
            return found;
        }
        
        function importResultsToTree(node, results) {
            if (node.type == "test" || node.type == "prepare") {
                if (node.passed === undefined) return;
                
                var group = results[node.passed];
                if (!group) debugger;
                
                var loop = node, parentList = [node];
                do {
                    loop = loop.parent;
                    parentList.push(loop);
                } while (loop.type != "file");
                
                (function recur(pNode, group, name){
                    if (!pNode) return;
                    
                    var groupNode;
                    if (!group.some(function(n){
                        if (n.label == pNode.label) {
                            groupNode = n;
                            return true;
                        }
                    })) {
                        groupNode = util.cloneObject(pNode, true);
                        
                        if (groupNode.type == "file")
                            group.unshift(groupNode);
                        else
                            group.splice(calcIndex(group, pNode), 0, groupNode);
                        
                        groupNode.children =
                        groupNode.items = [];
                        
                        if ((node.passed === 1 || node.passed === 4) && groupNode.type == "file")
                            groupNode.isOpen = false;
                    }
                    else {
                        var items = groupNode.items;
                        var isOpen = groupNode.isOpen;
                        util.extend(groupNode, pNode);
                        
                        groupNode.isOpen = isOpen;
                        groupNode.children = 
                        groupNode.items = items;
                    }
                    
                    delete groupNode.isSelected;
                    groupNode.passed = node.passed;
                    
                    if (groupNode.type == "test" || groupNode.type == "prepare") {
                        var cachedNode = state[name + " " + groupNode.label];
                        if (cachedNode && cachedNode.passed != groupNode.passed) {
                            do {
                                cachedNode.parent.items.remove(cachedNode);
                                cachedNode = cachedNode.parent;
                            } while(!cachedNode.items.length && cachedNode.type != "result");
                        }
                        state[name + " " + groupNode.label] = groupNode;
                    }
                    
                    recur(parentList.pop(), groupNode.items, (name ? name + " " : "") + groupNode.label);
                })(parentList.pop(), group, "");
            }
            else {
                node.items.forEach(function(n){
                    importResultsToTree(n, results);
                });
            }
        }
        
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
            get tree() { return tree; }
        });
        
        register(null, {
            "test.results": plugin
        });
    }
});
define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands", "test",
        "Menu", "MenuItem", "Divider", "tabManager", "save", "preferences", "fs"
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
        var save = imports.save;
        var prefs = imports.preferences;
        
        var Node = test.Node;
        
        var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        var LineWidgets = require("ace/line_widgets").LineWidgets;
        var dom = require("ace/lib/dom");
        // var Range = require("../range").Range;
        
        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "All Tests",
            index: 200,
            // showTitle: true,
            style: "flex:1;-webkit-flex:1"
        });
        var emit = plugin.getEmitter();
        
        var tree, stopping, menuContext, running;
        
        var wsNode = new Node({
            label: "workspace",
            isOpen: true,
            className: "heading",
            status: "loaded",
            noSelect: true,
            $sorted: true,
        });
        var rmtNode = new Node({
            label: "remote",
            isOpen: true,
            className: "heading",
            status: "loaded",
            noSelect: true,
            $sorted: true
        });
        var rootNode = new Node({
            label: "root",
            tree: tree,
            items: [wsNode]
        });
        
        function load() {
            panels.on("afterAnimate", function(){
                if (panels.isActive("test"))
                    tree && tree.resize();
            }, plugin);
            
            test.on("ready", function(){
                if (!test.config.excluded)
                    test.config.excluded = {};
                if (!test.config.skipped)
                    test.config.skipped = {};
            }, plugin);
            
            settings.on("read", function(){
                settings.setDefaults("user/test", [
                    ["inlineresults", true],
                    ["runonsave", true]
                ]);
            }, plugin);
            
            prefs.add({
                "Test" : {
                    position: 2000,
                    "Test Runner" : {
                        position: 100,
                        "Run Tests On Save" : {
                            type: "checkbox",
                            position: 50,
                            setting: "user/test/@runonsave"
                        },
                        "Show Inline Test Results" : {
                            type: "checkbox",
                            position: 100,
                            setting: "user/test/@inlineresults"
                        },
                        "Exclude These Files" : {
                           name: "txtTestExclude",
                           type: "textarea-row",
                           fixedFont: true,
                           width: 600,
                           height: 200,
                           rowheight: 250,
                           position: 1000
                       },
                    }
                }
            }, plugin);
            
            plugin.getElement("txtTestExclude", function(txtTestExclude) {
                var ta = txtTestExclude.lastChild;
                
                ta.on("blur", function(e) {
                    test.config.excluded = {};
                    ta.value.split("\n").forEach(function(rawLine){
                        var path = rawLine.split("#")[0].trim();
                        test.config.excluded[path] = rawLine;
                    });
                    test.saveConfig(function(){
                        // Trigger a refetch for all runners
                        test.refresh();
                    });
                });
                
                var update = function(){
                    var str = [];
                    for (var path in test.config.excluded) {
                        str.push(test.config.excluded[path]);
                    }
                    ta.setValue(str.join("\n"));
                };
                
                test.on("ready", update, plugin);
                test.on("updateConfig", update, plugin);
            }, plugin);
            
            // Save hooks
            save.on("afterSave", function(e){
                var runOnSave = settings.getBool("user/test/@runonsave");
                
                rootNode.findAllNodes("file").some(function(n){
                    if (n.path == e.path) {
                        
                        // Notify runners of change event and refresh tree 
                        if (n.emit("change", e.value))
                            tree && tree.refresh();
                            
                        // Re-run test on save
                        if (runOnSave) run([n], function(){});
                            
                        return true;
                    }
                });
            }, plugin);
            
            // Initiate test runners
            test.on("register", function(e){ init(e.runner) }, plugin);
            test.on("unregister", function(e){ deinit(e.runner) }, plugin);
            test.on("afterUpdate", function(){ tree && tree.refresh(); });
            
            test.runners.forEach(init);
            
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
                   else if (node.type == "testset") {
                       return "<span style='opacity:0.5;'>" + escapeHTML(node.label) + "</span>";
                   }
                   else if (node.kind == "it") {
                       return "it " + escapeHTML(node.label);
                   }
                   else if (node.type == "runner") {
                       return escapeHTML(node.label) + " (" 
                          + (!node.items.length && node.status == "loading" 
                            ? "loading" 
                            : node.items.length) 
                          + ")";
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
                    else if (node.skip) icon = "test-ignored";
                    else if (node.type == "testset") icon = "folder";
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
            
            tree.setRoot(rootNode);
            
            tree.commands.bindKey("Space", function(e) {
                openTestFile();
            });
            
            tree.commands.bindKey("Enter", function(e) {
                commands.exec("runtest");
            });
            
            tree.commands.bindKey("Shift-Enter", function(e) {
                commands.exec("runtestwithcoverage");
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
            
            // Hook opening of known files
            tabManager.on("open", function(e){
                var node, tab = e.tab;
                if (rootNode.findAllNodes("file").some(function(n){
                    node = n;
                    return n.path == tab.path;
                })) {
                    decorate(node, tab);
                }
            });
            
            // Menu
            menuContext = new Menu({ items: [
                new MenuItem({ command: "runtest", caption: "Run", class: "strong" }),
                new MenuItem({ command: "runtestwithcoverage", caption: "Run with Code Coverage" }),
                new Divider(),
                new MenuItem({ caption: "Open Test File", onclick: openTestFile }),
                new MenuItem({ caption: "Open Related Files", command: "openrelatedtestfiles" }), // TODO move to coverage plugin
                new MenuItem({ caption: "Open Raw Test Output", command: "opentestoutput" }),
                new Divider(),
                new MenuItem({ caption: "Skip", command: "skiptest" }),
                new MenuItem({ caption: "Remove", command: "removetest" })
            ] }, plugin);
            opts.aml.setAttribute("contextmenu", menuContext.aml);
            
            settings.on("read", function(){
                test.settingsMenu.append(new MenuItem({ 
                    caption: "Show Inline Test Results", 
                    checked: "user/test/@inlineresults",
                    type: "check",
                    position: 100
                }));
            }, plugin);
            
            settings.on("user/test/@inlineresults", function(value){
                if (!value)
                    clearAllDecorations();
                else
                    rootNode.findAllNodes("file").forEach(function(fileNode){
                        if (fileNode.passed === undefined) return;
                        var tab = tabManager.findTab(fileNode.path);
                        if (tab) decorate(fileNode, tab);
                    });
            }, plugin);
            
            tree.resize();
        }
        
        /***** Helper Methods *****/
        
        function populate(node, callback){
            var runner = node.findRunner();
            
            updateStatus(node, "loading");
            
            runner.populate(node, function(err){
                if (err) return callback(err); // TODO
                
                updateStatus(node, "loaded");
                node.fixParents();
                
                if (node.skip) {
                    node.findAllNodes("test").forEach(function(n){
                        n.skip = true;
                    });
                }
                
                callback();
            });
        }
        
        function filter(path){
            return test.config.excluded[path];
        }
        
        function init(runner){
            if (!test.ready) return test.on("ready", init.bind(this, runner));
            
            var parent = runner.remote ? rmtNode : wsNode;
            runner.root.parent = parent;
            parent.items.push(runner.root);
            
            updateStatus(runner.root, "loading");
            
            runner.init(filter, function(err){
                if (err) return console.error(err); // TODO
                
                runner.root.isOpen = true;
                updateStatus(runner.root, "loaded");
                
                runner.root.findAllNodes("file").forEach(function(node){
                    if (!test.config.skipped[node.path]) return;
                    
                    node.skip = true;
                    node.findAllNodes("test").forEach(function(n){
                        n.skip = true;
                    });
                });
                
                runner.root.fixParents();
            });
        }
        
        function deinit(runner){
            if (runner.root.parent) {
                var items = runner.root.parent.items;
                items.splice(items.indexOf(runner.root), 1);
            }
            
            tree.refresh();
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
                var tab;
                
                if (n.type == "file") {
                    if (onlyWhenOpen) {
                        tab = tabManager.findTab(n.path);
                        if (!tab || !tab.isActive())
                            return;
                    }
                    
                    tabManager.openFile(n.path, true, function(){});
                }
                else if (n.pos) {
                    var fileNode = n.findFileNode();
                    if (onlyWhenOpen) {
                        tab = tabManager.findTab(fileNode.path);
                        if (!tab || !tab.isActive())
                            return;
                    }
                    
                    var pos = n.selpos || n.pos;
                    var select = n.selpos ? {
                        row: n.selpos.el,
                        column: n.selpos.ec
                    } : undefined;
                    
                    tabManager.open({
                        path: fileNode.path,
                        active: true
                    }, function(err, tab){
                        var ace = tab.editor.ace;
                        
                        var scroll = function(){
                            ace.selection.clearSelection();
                            scrollToDefinition(ace, n.pos.sl, n.pos.el);
                            
                            ace.moveCursorTo(pos.sl - 1, pos.sc);
                            if (select)
                                ace.getSession().getSelection().selectToPosition({ row: pos.el - 1, column: pos.ec });
                        };
                        
                        if (!ace.session.doc.$lines.length)
                            ace.once("changeSession", scroll);
                        else if (!ace.renderer.$cursorLayer.config)
                            ace.once("afterRender", scroll);
                        else
                            scroll();
                    });
                }
            });
        }
        
        /***** Methods *****/
        
        function run(nodes, options, callback){
            running = true;
            
            if (nodes && !Array.isArray(nodes))
                callback = options, options = nodes, nodes = null;
            
            if (typeof options == "function")
                callback = options, options = null;
            
            if (!nodes)
                nodes = tree.selectedNodes;
            
            var parallel = !options || options.parallel === undefined
                ? settings.getBool("shared/test/@parallel")
                : options.parallel; // TODO have a setting per runner
            
            var withCodeCoverage = options && options.withCodeCoverage;
            
            var list = [], found = {};
            nodes.forEach(function(n){
                if (n.type == "all" || n.type == "root")
                    n.findAllNodes("file").forEach(function(n){ 
                        if (n.skip) return;
                        list.push(n); 
                        found[n.path] = true;
                    });
                else if (withCodeCoverage) {
                    var fileNode = n.findFileNode();
                    if (!found[fileNode.path])
                        list.push(fileNode);
                }
                else
                    list.push(n);
            });
            
            // clear all previous states of list before running any
            // clear();
            
            async[parallel ? "each" : "eachSeries"](list, function(node, callback){
                if (stopping) return callback(new Error("Terminated"));
                
                if (node.status == "pending") { // TODO do this lazily
                    return populate(node, function(err){
                        if (err) return callback(err);
                        _run(node, options, callback);
                    });
                }
                
                _run(node, options, callback);
            }, function(err){
                emit("stop");
                running = false;
                delete progress.stop;
                
                callback(err, list);
            });
        }
        
        var progress = {
            log: function(node, chunk){
                node.fullOutput += chunk;
                emit("log", chunk);
            },
            start: function(node){
                updateStatus(node, "running");
            },
            end: function(node){
                updateStatus(node, "loaded");
            }
        };
        
        function findTest(path){
            return (function recur(items){
                for (var j, i = 0; i < items.length; i++) {
                    j = items[i];
                    if (j.type == "file") {
                        if (j.path == path) return j;
                    }
                    else if (j.items) recur(j.items);
                }
            })(rootNode.items);
        }
        
        function _run(node, options, callback){
            var runner = node.findRunner();
            var fileNode = node.findFileNode();
            
            fileNode.fullOutput = ""; // Reset output
            updateStatus(node, "running");
            
            progress.stop = runner.run(node, progress, options, function(err){
                updateStatus(node, "loaded");
                emit("result", { node: node });
                
                var tab = tabManager.findTab(fileNode.path);
                if (tab) decorate(fileNode, tab);
                
                callback(err, node);
            });
        }
        
        function refreshTree(node){
            while (node && !node.tree) node = node.parent;
            var T = node && node.tree || tree;
            if (T) T.refresh();
        }
        
        function updateStatus(node, s){
            // TODO make this more efficient by trusting the child nodes
            if (node.type == "file" || node.type == "testset") {
                var tests = node.findAllNodes("test|prepare");
                
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
            else if (node.type == "root") {
                refreshTree(node);
                return;
            }
            else {
                node.status = s;
            }
            
            if (node.parent) updateStatus(node.parent, s);
            else refreshTree(node);
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
                node = rootNode;
            
            node.items.forEach(function(n){
                n.passed = undefined;
                if (n.items) clear(n);
            });
            
            if (node == rootNode) 
                tree.refresh();
            
            clearAllDecorations();
        }
        
        function skip(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            var map = {};
            nodes.forEach(function(fileNode){
                if (fileNode.type != "file") return;
                
                if (!map[fileNode.path]) {
                    fileNode.skip = !fileNode.skip;
                    
                    if (fileNode.skip)
                        test.config.skipped[fileNode.path] = true;
                    else
                        delete test.config.skipped[fileNode.path];
                        
                    fileNode.findAllNodes("test").forEach(function(n){
                        n.skip = fileNode.skip;
                    });
                    
                    map[fileNode.path] = true;
                }
            });
            
            test.saveConfig(function(err){
                tree.refresh();
                callback(err);
            });
        }
        
        function remove(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            nodes.forEach(function(fileNode){
                if (fileNode.type != "file") return;
                
                if (!test.config.excluded[fileNode.path]) {
                    fileNode.parent.children.remove(fileNode);
                    fileNode.parent.items.remove(fileNode);
                    test.config.excluded[fileNode.path] = true;
                }
            });
            
            test.saveConfig(function(err){
                tree.refresh();
                callback(err);
            });
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
        
        // TODO: Think about moving this to a separate plugin
        function decorate(fileNode, tab) {
            if (!settings.getBool("user/test/@inlineresults")) return;
            
            var editor = tab.editor.ace;
            var session = (tab.document.getSession() || 0).session;
            if (!session || !tab.isActive()) {
                tab.once("activate", function(){
                    setTimeout(function(){ decorate(fileNode, tab); });
                });
                return;
            }
            
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                session.widgetManager.attach(editor);
            }
            
            clearDecoration(session);
            
            var nodes = fileNode.findAllNodes("test|prepare");
            nodes.forEach(function(node){
                if (node.passed !== undefined) {
                    session.addGutterDecoration(node.pos.sl - 1, "test-" + node.passed);
                    (session.$markers || (session.$markers = [])).push([node.pos.sl - 1, "test-" + node.passed]);
                }
                if (node.annotations)
                    createStackWidget(editor, session, node);
                if (node.output)
                    createOutputWidget(editor, session, node);
            });
        }
        
        function createOutputWidget(editor, session, node){
            // editor.session.unfold(pos.row);
            // editor.selection.moveToPosition(pos);
            
            var w = {
                row: node.pos.el - 1, 
                // fixedWidth: true,
                // coverGutter: true,
                // rowCount: 0,
                // coverLine: 1,
                el: dom.createElement("div")
            };
            var extraClass = node.passed == 2 ? "ace_error" : "ace_warning";
            var el = w.el.appendChild(dom.createElement("div"));
            var arrow = w.el.appendChild(dom.createElement("div"));
            arrow.className = "error_widget_arrow " + extraClass;
            
            var left = editor.renderer.$cursorLayer
                .getPixelPosition({ column: node.pos.ec - 1 }).left;
            arrow.style.left = left + editor.renderer.gutterWidth - 5 + "px";
            
            w.el.className = "error_widget_wrapper";
            el.style.whiteSpace = "pre";
            el.className = "error_widget " + extraClass;
            el.innerHTML = node.output;
            
            el.appendChild(dom.createElement("div"));
            
            // var kb = function(_, hashId, keyString) {
            //     if (hashId === 0 && (keyString === "esc" || keyString === "return")) {
            //         w.destroy();
            //         return {command: "null"};
            //     }
            // };
            
            // w.destroy = function() {
            //     if (editor.$mouseHandler.isMousePressed)
            //         return;
            //     editor.keyBinding.removeKeyboardHandler(kb);
            //     session.widgetManager.removeLineWidget(w);
            //     editor.off("changeSelection", w.destroy);
            //     editor.off("changeSession", w.destroy);
            //     editor.off("mouseup", w.destroy);
            //     editor.off("change", w.destroy);
            // };
            
            // editor.keyBinding.addKeyboardHandler(kb);
            // editor.on("changeSelection", w.destroy);
            // editor.on("changeSession", w.destroy);
            // editor.on("mouseup", w.destroy);
            // editor.on("change", w.destroy);
            
            session.widgetManager.addLineWidget(w);
            session.$lineWidgets.push(w);
            
            w.el.onmousedown = editor.focus.bind(editor);
        }
        
        function createStackWidget(editor, session, node){
            if (!editor.decorated) {
                editor.renderer.on("afterRender", updateLines);
                var onMouseDown = function(e) {
                    var widget = e.target;
                    if (widget.annotation 
                      && widget.classList.contains("widget") 
                      && widget.classList.contains("more")) {
                        var a = widget.annotation;
                        createOutputWidget(editor, a.session, {
                            pos: { el: a.line, ec: a.column },
                            passed: 0,
                            output: a.more
                        });
                        
                        widget.classList.remove("more");
                        widget.annotation = null;
                        e.stopPropagation();
                    }
                };
                editor.container.addEventListener("mousedown", onMouseDown, true);
            }
            
            var m, d;
            node.annotations.forEach(function(item){
                m = item.message.trim();
                d = m.length <= 50 ? m : m.substr(0, 20) + " ... " + m.substr(-25);
                
                session.lineAnnotations[item.line - 1] = { 
                    display: d,
                    line: item.line,
                    column: item.column,
                    more: m.length > 50 ? m : null,
                    session: session
                };
            });
        }
        
        var updateLines = function(e, renderer) {
            var textLayer = renderer.$textLayer;
            var config = textLayer.config;
            var session = textLayer.session;
            
            if (!session.lineAnnotations) return;
            
            var first = config.firstRow;
            var last = config.lastRow;
            
            var lineElements = textLayer.element.childNodes;
            var lineElementsIdx = 0;
            
            var row = first;
            var foldLine = session.getNextFoldLine(row);
            var foldStart = foldLine ? foldLine.start.row : Infinity;
            
            while (true) {
                if (row > foldStart) {
                    row = foldLine.end.row + 1;
                    foldLine = textLayer.session.getNextFoldLine(row, foldLine);
                    foldStart = foldLine ? foldLine.start.row : Infinity;
                }
                if (row > last)
                    break;
                
                var lineElement = lineElements[lineElementsIdx++];
                if (lineElement && session.lineAnnotations[row]) {
                    var widget, a = session.lineAnnotations[row];
                    if (!a.element) {
                        widget = document.createElement("span");
                        widget.textContent = a.display;
                        widget.className = "widget stack-message" + (a.more ? " more" : "");
                        widget.annotation = a;
                        session.lineAnnotations[row].element = widget;
                    }
                    else widget = a.element;
                    
                    lineElement.appendChild(widget);
                }
                row++;
            }
        };
        
        function clearAllDecorations() {
            tabManager.getTabs().forEach(function(tab){
                if (tab.editorType != "ace") return;
                var session = tab.document.getSession().session;
                if (session) clearDecoration(session);
            });
        }
        
        function clearDecoration(session){
            if (session.$markers) {
                session.$markers.forEach(function(m){
                    session.removeGutterDecoration(m[0], m[1]);
                });
            }
            if (session.lineAnnotations) {
                session.lineAnnotations.forEach(function(item){
                    if (item.element && item.element.parentNode)
                        item.element.parentNode.removeChild(item.element);
                });
            }
            if (session.$lineWidgets) {
                session.$lineWidgets.forEach(function(widget){
                    session.widgetManager.removeLineWidget(widget);
                });
            }
            session.$markers = [];
            session.lineAnnotations = [];
            session.$lineWidgets = [];
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
            get contextMenu() { return menuContext },
            
            /**
             * 
             */
            get root() { return rootNode; },
            
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
            skip: skip,
            
            /**
             * 
             */
            remove: remove,
            
            /**
             *
             */
            openTestFile: openTestFile,
            
            /**
             * 
             */
            findTest: findTest
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});
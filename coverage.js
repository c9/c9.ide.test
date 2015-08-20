define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "test", "ui", "layout", "test.all", "c9", "util", 
        "tabManager", "commands", "settings", "Menu", "MenuItem", "Divider",
        "preferences", "save"
    ];
    main.provides = ["test.coverage"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var test = imports.test;
        var all = imports["test.all"];
        var ui = imports.ui;
        var c9 = imports.c9;
        var util = imports.util;
        var layout = imports.layout;
        var commands = imports.commands;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var save = imports.save;
        var prefs = imports.preferences;
        
        var Range = require("ace/range").Range;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var files = {};
        var tests = {};
        var showCoverage = false;
        var reWs = new RegExp("^" + util.escapeRegExp(c9.workspaceDir));
        var menu, button;
        
        function load() {
            test.on("coverage", function(e){
                var node = e.node;
                addToLibrary(node);
                
                if (!showCoverage)
                    commands.exec("togglecoverage");
            }, plugin);
            
            test.on("clear", function(){
                clear();
            }, plugin);
            
            // Hook opening of known files
            tabManager.on("open", function(e){
                var tab = e.tab;
                if (!showCoverage) return;
                
                if (files[tab.path])
                    decorateFile(tab);
                else if (tests[tab.path])
                    decorateTest(tab);
            });
            
            commands.addCommand({
                name: "openrelatedtestfiles",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(editor, args){
                    var tree = test.focussedPanel.tree;
                    var fileNode = findFileNode(tree.selectedNode);
                    
                    if (tests[fileNode.path]) {
                        tests[fileNode.path].all.forEach(function(coverage){
                            tabManager.openFile(coverage.file.replace(reWs, ""), 
                                true, function(){});
                        });
                    }
                },
                isAvailable: function(){
                    var tree = test.focussedPanel.tree;
                    if (!tree.selectedNode) return false;
                    var fileNode = findFileNode(tree.selectedNode);
                    return tests[fileNode.path] ? true : false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "togglecoverage",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    showCoverage = !showCoverage;
                    settings.set("state/test/coverage/@show", showCoverage);
                    
                    if (!showCoverage)
                        clearAllDecorations();
                    else {
                        var tab;
                        for (var path in tests) {
                            tab = tabManager.findTab(path);
                            if (tab) decorateTest(tab);
                        }
                        for (var path in files) {
                            tab = tabManager.findTab(path);
                            if (tab) decorateFile(tab);
                        }
                    }
                },
                isAvailable: function(){
                    for (var prop in tests) { return true; }
                    return false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "clearcoverage",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(){
                    clear();
                },
                isAvailable: function(){
                    for (var prop in tests) { return true; }
                    return false;
                }
            }, plugin);
            
            settings.on("read", function(){
                settings.setDefaults("user/test/coverage", [
                    ["alwayson", false],
                    ["fullline", true],
                    ["testfiles", false],
                    ["toolbar", true]
                ]);
                
                settings.setDefaults("state/test/coverage", [
                    ["show", false]
                ]);
                
                settings.set("state/test/coverage/@show", false);
                
                var totalCoverage = settings.getNumber("state/test/coverage/@total");
                if (totalCoverage && settings.getBool("user/test/coverage/@toolbar")) {
                    draw();
                    
                    var amount = button.$ext.querySelector(".amount");
                    amount.innerHTML = totalCoverage + "%";
                    button.show();
                }
                
                all.once("draw", function(){
                    test.settingsMenu.append(new Divider({ position: 400 }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Show Coverage", 
                        type: "check",
                        checked: "state/test/coverage/@show",
                        position: 500,
                        command: "togglecoverage"
                    }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Always Run With Code Coverage", 
                        checked: "user/test/coverage/@alwayson",
                        type: "check",
                        position: 600
                    }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Mark Full Line Coverage In Editor", 
                        checked: "user/test/coverage/@fullline",
                        type: "check",
                        position: 700
                    }));
                });
            }, plugin);
            
            settings.on("user/test/coverage/@fullline", function(value){
                if (!showCoverage) return;
                commands.exec("togglecoverage");
                commands.exec("togglecoverage");
            }, plugin);
            settings.on("user/test/coverage/@testfiles", function(value){
                if (!showCoverage) return;
                var tab;
                if (value) {
                    for (var path in tests) {
                        tab = tabManager.findTab(path);
                        if (tab) decorateTest(tab);
                    }
                }
                else {
                    for (var path in tests) {
                        tab = tabManager.findTab(path);
                        if (tab) {
                            var session = tab.document.getSession().session;
                            if (session) clearDecoration(session);
                        }
                    }
                }
            }, plugin);
            settings.on("user/test/coverage/@toolbar", function(value){
                value 
                    ? settings.getNumber("state/test/coverage/@total") && button.show() 
                    : button.hide();
            }, plugin);
            
            prefs.add({
                "Test" : {
                    position: 1000,
                    "Code Coverage" : {
                        position: 400,
                        "Always Run With Code Coverage" : {
                            type: "checkbox",
                            position: 100,
                            setting: "user/test/coverage/@alwayson"
                        },
                        "Mark Full Line Coverage In Editor" : {
                            type: "checkbox",
                            position: 200,
                            setting: "user/test/coverage/@fullline"
                        },
                        "Show Code Coverage In Test Files" : {
                            type: "checkbox",
                            position: 300,
                            setting: "user/test/coverage/@testfiles"
                        },
                        "Show Total Code Coverage In Toolbar" : {
                            type: "checkbox",
                            position: 400,
                            setting: "user/test/coverage/@toolbar"
                        },
                    }
                }
            }, plugin);
            
            // Save hooks
            // TODO figure out what changed in the file and only run applicable tests
            save.on("afterSave", function(e){
                if (!settings.getBool("user/test/@runonsave") || !files[e.path])
                    return;
                
                var tests = Object.keys(files[e.path].coverage).map(function(path){
                    return all.findTest(path);
                });
                commands.exec("runtest", null, { nodes: tests });
            }, plugin);
        }
        
        var drawn;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            menu = new Menu({ items: [
                new MenuItem({ 
                    caption: "Show Coverage", 
                    checked: "state/test/coverage/@show",
                    type: "check",
                    position: 500,
                    command: "togglecoverage"
                }),
                new MenuItem({ 
                    caption: "Clear", 
                    command: "clearcoverage"
                })
            ]}, plugin);

            button = new ui.button({
                "skin": "c9-simple-btn",
                // "caption" : "Share",
                "class": "coverage-btn",
                "visible": false,
                "submenu": menu.aml
            });
            
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), button, 865, plugin);
        
            // TODO threshold red: #AB4E4E, green: #3E713E
            button.$ext.innerHTML = '\
                <div class="title">Code coverage</div>\
                <div class="amount">~</div>';
            
            emit.sticky("draw");
        }
        
        /***** Methods *****/
        
        function findFileNode(node){
            while (node.type != "file") node = node.parent;
            return node;
        }
        
        function addToLibrary(node){
            var fileNode = findFileNode(node);
            
            if (!tests[fileNode.path])
                tests[fileNode.path] = { all: node.coverage };
            
            node.coverage.forEach(function(coverage){
                var path = coverage.file.replace(reWs, "");
                var tab;
                
                if (tests[path]) {
                    tests[path].own = coverage;
                    tab = tabManager.findTab(path);
                    if (tab) decorateTest(tab);
                }
                else {
                    var fInfo = files[path] || (files[path] = { coverage: {}, lines: {}, coveredLines: 0 });
                    var isNew = fInfo.coverage[fileNode.path] ? false : true;
                    fInfo.coverage[fileNode.path] = coverage;
                    fInfo.totalLines = coverage.lines.found;
                    
                    var update = function(coverage){
                        coverage.lines.covered.forEach(function(nr){
                            if (!fInfo.lines[nr]) {
                                fInfo.coveredLines++;
                                fInfo.lines[nr] = true;
                            }
                        });
                        coverage.lines.uncovered.forEach(function(nr){
                            if (!fInfo.lines[nr])
                                fInfo.lines[nr] = false;
                        });
                    };
                    
                    if (isNew) {
                        update(coverage);
                    }
                    else {
                        fInfo.lines = {};
                        fInfo.coveredLines = 0;
                        
                        for (var id in fInfo.coverage) {
                            update(fInfo.coverage[id]);
                        }
                    }
                    
                    tab = tabManager.findTab(path);
                    if (tab) decorateFile(tab);
                }
            });
            
            updateGlobalCoverage();
            
            emit("update");
        }
        
        function updateGlobalCoverage(){
            var totalLines = 0, coveredLines = 0;
            
            for (var path in files) {
                var file = files[path];
                
                totalLines += file.totalLines;
                coveredLines += file.coveredLines;
            }
            
            draw();
            
            var amount = button.$ext.querySelector(".amount");
            var totalCoverage = Math.round(coveredLines / totalLines * 100);
            amount.innerHTML = totalLines ? totalCoverage + "%" : "~";
            button[totalLines ? "show" : "hide"]();
            settings.set("state/test/coverage/@total", totalCoverage);
        }
        
        function addMarker(session, type, row, showMarker) {
            var marker = showMarker
                ? session.addMarker(new Range(row, 0, row, 1), "test-" + type, "fullLine")
                : null;
            session.addGutterDecoration(row, type);
            session.coverageLines.push({ marker: marker, gutter: row, type: type });
        }

        function decorateTest(tab){
            if (!tests[tab.path]) return;
            if (!settings.getBool("user/test/coverage/@testfiles")) return;
            
            var coverage = tests[tab.path].own;
            var session = tab.document.getSession().session;
            if (!session) {
                tab.once("activate", function(){ setTimeout(function(){ decorateTest(tab); }); });
                return;
            }
            
            clearDecoration(session);
            
            var showMarker = settings.getBool("user/test/coverage/@fullline");
            coverage.lines.covered.forEach(function(row){
                addMarker(session, "covered", row - 1, showMarker);
            });
            coverage.lines.uncovered.forEach(function(row){
                addMarker(session, "uncovered", row - 1, showMarker);
            });
        }
        
        function decorateFile(tab){
            if (!files[tab.path]) return;
            
            var lines = files[tab.path].lines;
            var session = tab.document.getSession().session;
            if (!session) {
                tab.once("activate", function(){ setTimeout(function(){ decorateFile(tab); }); });
                return;
            }
            
            clearDecoration(session);
            
            var showMarker = settings.getBool("user/test/coverage/@fullline");
            for (var row in lines) {
                var css = lines[row] === true ? "covered" : "uncovered";
                addMarker(session, css, row - 1, showMarker);    
            }
        }
        
        function clearDecoration(session){
            if (session.coverageLines) {
                session.coverageLines.forEach(function(i){
                    if (i.marker) session.removeMarker(i.marker);
                    session.removeGutterDecoration(i.gutter, i.type);
                });
            }
            session.coverageLines = [];
        }
        
        function clearAllDecorations(){
            tabManager.getTabs().forEach(function(tab){
                if (tab.editorType != "ace") return;
                var session = tab.document.getSession().session;
                if (session && session.coverageLines) clearDecoration(session);
            });
            
            showCoverage = false;
            settings.set("state/test/coverage/@show", false);
        }
        
        function clear(){
            files = {};
            tests = {};
            settings.set("state/test/coverage/@total", "");
            
            if (drawn) {
                button.hide();
                clearAllDecorations();
            }
            
            emit("update");
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            get buttonMenu(){ return menu; },
            
            /**
             * 
             */
            get tests(){ return tests; },
            
            /**
             * 
             */
            get files(){ return files; },
            
            /**
             * 
             */
            clear: clear
        });
        
        register(null, {
            "test.coverage": plugin
        });
    }
});
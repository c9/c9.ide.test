define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "test", "ui", "layout", "test.all", "c9", "util", "tabManager"
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
        var tabManager = imports.tabManager;
        
        var Range = require("ace/range").Range;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var files = {};
        var tests = {};
        var reWs = new RegExp("^" + util.escapeRegExp(c9.workspaceDir));
        var menu, button;
        
        function load() {
            test.on("draw", function(){
                var toolbar = test.getElement("toolbar");
                
                ui.insertByIndex(toolbar, new ui.button({
                    caption: "Code Coverage",
                    skinset: "default",
                    skin: "c9-menu-btn"
                }), 100, plugin);
            }, plugin);
            
            test.on("coverage", function(e){
                var node = e.node;
                addToLibrary(node);
            }, plugin);
            
            // Hook opening of known files
            tabManager.on("open", function(e){
                var tab = e.tab;
                // if (!showCoverage) return;
                
                if (files[tab.path])
                    decorateFile(tab);
                else if (tests[tab.path])
                    decorateTest(tab)
            });
            
            draw();
        }
        
        function draw(){
            menu = new ui.menu({
                htmlNode: document.body,
                // width: 344,
                // height: 414,
                // class: "stats-menu"
            });

            button = new ui.button({
                "skin": "c9-simple-btn",
                // "caption" : "Share",
                "class": "coverage-btn",
                "submenu": menu
            });
            
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), button, 865, plugin);
        
            // TODO threshold red: #AB4E4E, green: #3E713E
            button.$ext.innerHTML = '\
                <div class="title">Code coverage</div>\
                <div class="amount">~</div>';
        }
        
        /***** Methods *****/
        
        function findFileNode(node){
            while (node.type != "file") node = node.parent;
            return node;
        }
        
        function addToLibrary(node){
            var fileNode = findFileNode(node);
            
            if (!tests[fileNode.path])
                tests[fileNode.path] = {};
            
            node.coverage.forEach(function(coverage){
                var path = coverage.file.replace(reWs, "");
                
                if (tests[path]) {
                    tests[path] = coverage;
                    var tab = tabManager.findTab(path);
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
                }
            });
            
            updateGlobalCoverage();
        }
        
        function updateGlobalCoverage(){
            var totalLines = 0, coveredLines = 0;
            
            for (var path in files) {
                var file = files[path];
                
                totalLines += file.totalLines;
                coveredLines += file.coveredLines;
            }
            
            var amount = button.$ext.querySelector(".amount");
            amount.innerHTML = totalLines ? Math.round(coveredLines / totalLines * 100) + "%" : "~";
        }
        
        function addMarker(session, type, row) {
            var marker = session.addMarker(new Range(row, 0, row, 1), "test-" + type, "fullLine");
            session.addGutterDecoration(row, type);
            session.coverageLines.push({ marker: marker, gutter: row, type: type });
        }

        function decorateTest(tab){
            var coverage = tests[tab.path];
            var session = tab.document.getSession().session;
            
            if (session.coverageLines) {
                session.coverageLines.forEach(function(i){
                    session.removeMarker(i.marker);
                    session.removeGutterDecoration(i.gutter, i.type);
                });
            }
            else session.coverageLines = [];
            
            coverage.lines.covered.forEach(function(row){
                addMarker(session, "covered", row - 1);
            });
            coverage.lines.uncovered.forEach(function(row){
                addMarker(session, "uncovered", row - 1);
            });
        }
        
        function decorateFile(tab){
            var lines = files[tab.path].lines;
            var session = tab.document.getSession().session;
            
            if (session.coverageLines) {
                session.coverageLines.forEach(function(i){
                    session.removeMarker(i.marker);
                    session.removeGutterDecoration(i.gutter, i.type);
                });
            }
            else session.coverageLines = [];
            
            for (var row in lines) {
                addMarker(session, lines[row] === true ? "covered" : "uncovered", row - 1);    
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            
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
            
        });
        
        register(null, {
            "test.coverage": plugin
        });
    }
});
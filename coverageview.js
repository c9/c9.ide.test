define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "save", "test.coverage", "Datagrid",
        "layout", "settings", "tabManager", "commands", "Divider", "MenuItem",
        "console"
    ];
    main.provides = ["test.coverageview"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var save = imports.save;
        var Editor = imports.Editor;
        var Datagrid = imports.Datagrid;
        var editors = imports.editors;
        var layout = imports.layout;
        var Divider = imports.Divider;
        var MenuItem = imports.MenuItem;
        var tabManager = imports.tabManager;
        var settings = imports.settings;
        var console = imports.console;
        var commands = imports.commands;
        var coverage = imports["test.coverage"];
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("coverageview", "Coverage View", CoverageView, extensions);
        
        handle.on("load", function(){
            commands.addCommand({
                name: "opencoverageview",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "F6", win: "F6" },
                group: "Test",
                exec: function(editor, args){
                    var tab;
                    if (tabManager.getTabs().some(function(t){
                        if (t.editorType == "coverageview") {
                            tab = t;
                            return true;
                        }
                    })) {
                        tabManager.focusTab(tab);
                    }
                    else {
                        tabManager.open({
                            editorType: "coverageview", 
                            focus: true, 
                            pane: console.getPanes()[0]
                        }, function(){});
                    }
                }
            }, handle);
            
            coverage.on("draw", function(){
                coverage.buttonMenu.append(new Divider());
                coverage.buttonMenu.append(new MenuItem({ 
                    caption: "Open Code Coverage View", 
                    command: "opencoverageview"
                }));
            }, handle);
        });
                          
        function CoverageView(){
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var datagrid;
            
            var BGCOLOR = { 
                "flat-light": "#f7f7f7", 
                "light": "#D3D3D3", 
                "light-gray": "#D3D3D3",
                "dark": "#3D3D3D",
                "dark-gray": "#3D3D3D" 
            };
            
            plugin.on("draw", function(e) {
                datagrid = new Datagrid({
                    container: e.htmlNode,
                
                    columns : [
                        {
                            caption: "Hierarchy",
                            value: "label",
                            width: "60%",
                            type: "tree"
                        }, 
                        {
                            caption: "Covered (%)",
                            width: "20%",
                            getText: function(node){
                                return node.covered + "%";
                            }
                        }, 
                        {
                            caption: "Not Covered",
                            value: "uncovered",
                            width: "20%"
                        }
                    ]
                }, plugin);
                
                datagrid.on("afterChoose", function(){
                    tabManager.openFile("/" + datagrid.selectedNode.label, true, function(){});
                });
                
                coverage.on("update", function(){
                    update();
                }, plugin);
                
                e.htmlNode.style.padding = 0;
                
                update();
            });
            
            /***** Method *****/
            
            function update(){
                var nodes = datagrid.root || [];
                var lookup = nodes.lookup || (nodes.lookup = {});
                
                var files = coverage.files;
                for (var path in files) {
                    var file = files[path];
                    var node = lookup[path];
                    if (!node) nodes.push(node = lookup[path] = { label: path.substr(1) });
                    node.covered = Math.round(file.coveredLines / file.totalLines * 100);
                    node.uncovered = file.totalLines - file.coveredLines;
                }
                
                datagrid.setRoot(nodes);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                
                function setTheme(e) {
                    var tab = doc.tab;
                    var isDark = e.theme == "dark";
                    
                    tab.backgroundColor = BGCOLOR[e.theme];
                    
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                
                layout.on("themeChange", setTheme, doc);
                setTheme({ theme: settings.get("user/general/@skin") });
                
                doc.tab.title = "Code Coverage";
            });
            
            plugin.on("documentActivate", function(e) {
                
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI({});
            
            plugin.load(null, "coverageview");
            
            return plugin;
        }
        
        register(null, {
            "test.coverageview": handle
        });
    }
});

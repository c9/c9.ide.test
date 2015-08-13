define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels"
    ];
    main.provides = ["test.all"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var Tree = imports.Tree;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "All Tests",
            index: 200,
            style: "flex:1;-webkit-flex:1"
        });
        var emit = plugin.getEmitter();
        
        var tree;
        
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
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
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
            
            tree.setRoot({
                label: "root",
                items: [{
                    label: "workspace",
                    isOpen: true,
                    className: "heading",
                    isRoot: true,
                    isFolder: true,
                    status: "loaded",
                    noSelect: true,
                    $sorted: true,
                    
                    items: [{
                        label: "test",
                        isFolder: true,
                        items: [
                            { label: "sub1" },
                            { label: "sub2" }
                        ]
                    }, { label: "test2", isFolder: true } ]
                }, {
                    label: "remote",
                    isOpen: true,
                    className: "heading",
                    isRoot: true,
                    isFolder: true,
                    status: "loaded",
                    noSelect: true,
                    $sorted: true,
                    
                    items: [{
                        label: "test",
                        isFolder: true,
                        items: [
                            { label: "sub1" },
                            { label: "sub2" }
                        ]
                    }, { label: "test2", isFolder: true } ]
                }]
            });
            
        }
        
        /***** Methods *****/
        
        function reloadModel() {
            if (!model) return;

            var groups = {};
            var packages = {};
            var root = [];

            ["custom", "pre", "core", "runtime"].forEach(function(name){
                root.push(groups[name] = {
                    items: [],
                    isOpen: name != "runtime",
                    className: "group",
                    isGroup: true,
                    isType: name,
                    noSelect: true,
                    name: GROUPS[name]
                });
            });

            var lut = ext.named;

            ext.plugins.forEach(function(plugin) {
                var info = architect.pluginToPackage[plugin.name];
                var packageName = info && info.package || "runtime";

                var groupName;
                if (CORE[packageName]) groupName = "core";
                else if (info && info.isAdditionalMode) groupName = "custom";
                else groupName = "pre";

                var package;
                if (packageName == "runtime") {
                    package = groups.runtime;
                }
                else {
                    package = packages[packageName];
                    if (!package)
                        groups[groupName].items.push(package = packages[packageName] = {
                            items: [],
                            isPackage: true,
                            className: "package",
                            parent: groups[groupName],
                            name: packageName
                        });
                }

                package.items.push({
                    name: plugin.name,
                    enabled: lut[plugin.name].loaded ? "true" : "false",
                    time: plugin.time,
                    version: info && info.version || "N/A",
                    parent: package,
                    package: packageName,
                    developer: plugin.developer == "Ajax.org"
                        ? "Cloud9"
                        : plugin.developer
                });
            });

            model.cachedRoot = { items: root };
            applyFilter();
        }

        function applyFilter() {
            model.keyword = filterbox && filterbox.getValue();

            if (!model.keyword) {
                model.reKeyword = null;
                model.setRoot(model.cachedRoot);

                // model.isOpen = function(node){ return node.isOpen; }
            }
            else {
                model.reKeyword = new RegExp("("
                    + util.escapeRegExp(model.keyword) + ")", 'i');
                var root = search.treeSearch(model.cachedRoot.items, model.keyword, true);
                model.setRoot(root);

                // model.isOpen = function(node){ return true; };
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
            get tree() { return tree; }
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});
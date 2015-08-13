define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels"
    ];
    main.provides = ["test.results"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var Tree = imports.Tree;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "Test Results",
            index: 100,
            height: 150
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
                maxLines: 50,
            
                getIconHTML: function(node) {
                    var icon = node.isFolder ? "folder" : "default";
                    if (node.status === "loading") icon = "loading";
                    return "<span class='ace_tree-icon " + icon + "'></span>";
                },
                
                getCaptionHTML: function(node){
                    return node.label + (node.isRoot 
                        ? " <span style='font-size:11px'>(" 
                            + node.items.length + ")</span>"
                        : "");
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
                    label: "failed",
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
                    label: "passed",
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
            
            tree.on("afterRender", recalc);
            
            // plugin.hide();
        }
        
        /***** Methods *****/
        
        function recalc(){
            var cells = tree.container.querySelector(".ace_tree_cells").lastChild;
            plugin.height = cells.scrollHeight + tree.container.parentNode.offsetTop + 20;
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
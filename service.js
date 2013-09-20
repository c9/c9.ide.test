define(function(require, exports, module) {
    main.consumes = [
        "plugin", "c9", "util", "settings", "ui", "layout",
        "anims", "menus", "test"
    ];
    main.provides = ["testservice"];
    return main;

    function main(options, imports, register) {
        var c9       = imports.c9;
        var util     = imports.util;
        var Plugin   = imports.plugin;
        var settings = imports.settings;
        var ui       = imports.ui;
        var anims    = imports.anims;
        var menus    = imports.menus;
        var layout   = imports.layout;
        
        function Service(){
            
            /***** Initialization *****/
            
            // Service extends ext.Plugin
            Plugin.call(this, developer, deps);
            
            // Get a reference to the event emitter
            var plugin = this;
            var emit   = plugin.getEmitter();
            
            var loaded = false;
            function load(){
                if (loaded) return false;
                loaded = true;
            }
            
            var drawn = false;
            function draw(){
                if (drawn) return;
                drawn = true;
                
                // Import Skin
                ui.insertSkin({
                    name         : "c9statusbar",
                    data         : require("text!./skin.xml"),
                    "media-path" : options.staticPrefix + "/images/",
                    "icon-path"  : options.staticPrefix + "/icons/"
                }, plugin);
                
                // Create UI elements
                ui.insertMarkup(layout.findParent(plugin), markup, plugin);
            
                emit("draw");
            }
            
            /***** Methods *****/
            
            
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
                load();
            });
            plugin.on("enable", function(){
                
            });
            plugin.on("disable", function(){
                
            });
            plugin.on("unload", function(){
                loaded = false;
                drawn  = false;
            });
            
            /***** Register and define API *****/
            
            /**
             * Draws the file tree
             * @event afterfilesave Fires after a file is saved
             *   object:
             *     node     {XMLNode} description
             *     oldpath  {String} description
             **/
            plugin.freezePublicAPI({
                /**
                 * Launches the Save As window which allows the user to save the 
                 * currently active file under a new name an path
                 * @param page {Page} an alternative page to save as
                 * @param callback {Function} called after the file is saved
                 */
                show : show
                
                
            });
        }
        
        register(null, {
            testservice: Service
        });
    }
});
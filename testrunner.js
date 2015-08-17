define(function(require, module, exports) {
    main.consumes = ["Plugin", "test"];
    main.provides = ["TestRunner"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var test = imports.test;

        function TestRunner(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            // var emit = plugin.getEmitter();

            var caption = options.caption;
            var index = options.index || 100;
            var root = {
                label: caption,
                runner: plugin,
                isOpen: true,
                type: "root",
                items: []
            }
            var all = {
                type: "all",
                label: "All Tests",
                items: []
            }
            root.items.push(all);
            
            plugin.on("load", function(){
                test.register(plugin);
            });
            
            plugin.on("unload", function(){
                test.unregister(plugin);
            });

            /***** Methods *****/

            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();

            plugin.freezePublicAPI({
                /**
                 * @property {String} caption
                 */
                get caption(){ return caption; },
                
                /**
                 * @property {Number} height
                 */
                get index(){ return index; },
                set index(v){ /* TODO */ },
                
                /**
                 * @property {Object} root
                 */
                root: root,
                all: all
            });

            return plugin;
        }

        /***** Register and define API *****/

        register(null, {
            TestRunner: TestRunner
        });
    }
});

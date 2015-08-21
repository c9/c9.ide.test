define(function(require, module, exports) {
    main.consumes = ["Plugin", "test"];
    main.provides = ["TestRunner"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var test = imports.test;
        
        var Node = test.Node;

        function TestRunner(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            // var emit = plugin.getEmitter();

            var caption = options.caption;
            var index = options.index || 100;
            
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
                 * @property {Object} root
                 */
                root: new Node({
                    label: caption,
                    index: index,
                    runner: plugin,
                    type: "root"
                })
            });

            return plugin;
        }

        /***** Register and define API *****/

        register(null, {
            TestRunner: TestRunner
        });
    }
});

define(function(require, module, exports) {
    main.consumes = ["Plugin", "test", "Form"];
    main.provides = ["TestRunner"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Form = imports.Form;
        var test = imports.test;
        
        var Node = test.Node;

        function TestRunner(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            // var emit = plugin.getEmitter();

            var caption = options.caption;
            var formOptions = options.options || [];
            var index = options.index || 100;
            var meta = {};
            var form;
            
            plugin.on("load", function(){
                test.register(plugin);
            });
            
            plugin.on("unload", function(){
                test.unregister(plugin);
            });

            /***** Methods *****/
            
            function getForm(){
                if (!formOptions.length) return false;
                if (form) return form;
                
                form = new Form({ 
                    form: formOptions,
                    colwidth: 100,
                    style: "width:300px"
                }, plugin);
                
                return form;
            }

            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();

            plugin.freezePublicAPI({
                /**
                 * @property {String} caption
                 */
                get caption(){ return caption; },
                
                /**
                 * @property {Array} options
                 */
                get form(){ return getForm(); },
                
                /**
                 * 
                 */
                get meta(){ return meta; },
                
                /**
                 * @property {Object} root
                 */
                root: new Node({
                    label: caption,
                    index: index,
                    runner: plugin,
                    type: "runner"
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

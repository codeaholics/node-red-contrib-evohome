module.exports = function(RED) {
    function EvohomeSiteConfiguration(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        node.json = n.json;
    }
    RED.nodes.registerType('evohome-site-configuration', EvohomeSiteConfiguration);
}

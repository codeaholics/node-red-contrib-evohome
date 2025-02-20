export default function(RED) {
    class EvohomeSiteConfiguration {
        constructor(n) {
            RED.nodes.createNode(this, n);
            const node = this;

            node.json = n.json;
        }
    }
    RED.nodes.registerType('evohome-site-configuration', EvohomeSiteConfiguration);
}

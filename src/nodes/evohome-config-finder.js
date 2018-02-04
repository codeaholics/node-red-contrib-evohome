const Address = require('../address');

const ADDRESS_REGEX = /\b\d{2}:\d{6}\b/g;

function findAddresses(obj, result = []) {
    if (typeof obj === 'string') {
        let match;
        while ((match = ADDRESS_REGEX.exec(obj)) !== null) {
            result.push(match[0]);
        }
    } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            findAddresses(obj[i], result);
        }
    } else {
        Object.keys(obj).forEach(k => findAddresses(obj[k], result));
    }
    return result;
}

module.exports = function(RED) {
    function EvohomeConfigFinder(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const configNode = RED.nodes.getNode(n.config);
        node.config = JSON.parse(configNode.json);

        node.on('input', (msg) => {
            // eslint-disable-next-line arrow-body-style
            const addresses = findAddresses(msg.payload).filter((elem, pos, arr) => {
                return arr.indexOf(elem) === pos;
            });

            addresses.map(addr => new Address(addr, node.config)).forEach((addr) => {
                if (!addr.isConfigured() && !addr.isSiteController()) {
                    node.send({
                        payload: addr.describe()
                    });
                }
            });
        });
    }
    RED.nodes.registerType('evohome-config-finder', EvohomeConfigFinder);
};

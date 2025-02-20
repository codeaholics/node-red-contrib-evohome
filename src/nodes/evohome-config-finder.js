import Address from '../address';
import Config from '../config';

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

export default function(RED) {
    class EvohomeConfigFinder {
        constructor(n) {
            RED.nodes.createNode(this, n);
            const node = this;

            const configNode = RED.nodes.getNode(n.config);
            node.config = new Config(JSON.parse(configNode.json));

            node.on('input', (msg) => {
                /* eslint-disable dot-location */
                findAddresses(msg.payload).
                    filter((elem, pos, arr) => arr.indexOf(elem) === pos).
                    map(addr => new Address(addr, node.config)).
                    filter(addr => !addr.isConfigured() && !addr.isSiteController()).
                    forEach(addr => node.send({
                        payload: addr.describe()
                    }));
                /* eslint-enable dot-location */
            });
        }
    }
    RED.nodes.registerType('evohome-config-finder', EvohomeConfigFinder);
}

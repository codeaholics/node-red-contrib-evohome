const ADDR_TYPE_CONTROLLER = 1;
const ADDR_TYPE_ZONE = 4;
const ADDR_TYPE_SENSOR = 7;
const ADDR_TYPE_OPENTHERM = 10;
const ADDR_TYPE_RELAY = 13;
const ADDR_TYPE_GATEWAY = 18;
const ADDR_TYPE_REMOTE = 30;
// TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/3

const TYPE_NAMES = [];

TYPE_NAMES[ADDR_TYPE_CONTROLLER] = 'controller';
TYPE_NAMES[ADDR_TYPE_ZONE] = 'zone';
TYPE_NAMES[ADDR_TYPE_SENSOR] = 'sensor';
TYPE_NAMES[ADDR_TYPE_OPENTHERM] = 'opentherm';
TYPE_NAMES[ADDR_TYPE_RELAY] = 'relay';
TYPE_NAMES[ADDR_TYPE_GATEWAY] = 'gateway';
TYPE_NAMES[ADDR_TYPE_REMOTE] = 'remote';

function Address(addr, controllers) {
    if (!(this instanceof Address)) return new Address(addr);
    this.addr = addr;
    this.controllers = controllers;
    this.type = +(this.addr.substr(0, 2));
}

Address.prototype.toString = function() {
    return this.addr;
};

Address.prototype.describe = function() {
    return {
        addr: this.addr,
        type: TYPE_NAMES[this.type]
    };
};

Address.prototype.isSiteController = function() {
    return this.isController() && this.controllers.includes(this.addr);
};

Address.prototype.isController = function() { return this.type === ADDR_TYPE_CONTROLLER; };
Address.prototype.isZone = function() { return this.type === ADDR_TYPE_ZONE; };
Address.prototype.isSensor = function() { return this.type === ADDR_TYPE_SENSOR; };
Address.prototype.isOpenTherm = function() { return this.type === ADDR_TYPE_OPENTHERM; };
Address.prototype.isRelay = function() { return this.type === ADDR_TYPE_RELAY; };
Address.prototype.isGateway = function() { return this.type === ADDR_TYPE_GATEWAY; };
Address.prototype.isRemote = function() { return this.type === ADDR_TYPE_REMOTE; };

function Message(parsed, config) {
    if (!(this instanceof Message)) return new Message(parsed, config);

    this.parsed = parsed;
    this.config = config;

    this.bytes = Buffer.from(this.parsed.payload, 'hex');
    this.addrs = Object.freeze([
        new Address(this.parsed.addr[0], this.config.controllers),
        new Address(this.parsed.addr[1], this.config.controllers),
        new Address(this.parsed.addr[2], this.config.controllers)
    ]);
    this.p = 0;
}

Object.defineProperty(Message.prototype, 'length', {
    get() { return this.parsed.len; }
});

Object.defineProperty(Message.prototype, 'addr', {
    get() { return this.addrs; }
});

Message.prototype.getUInt8 = function() {
    const result = this.bytes.readUInt8(this.p);
    this.p += 1;
    return result;
};

module.exports = Message;

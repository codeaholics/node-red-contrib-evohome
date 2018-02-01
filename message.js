var ADDR_TYPE_CONTROLLER = 1;
var ADDR_TYPE_ZONE = 4;
var ADDR_TYPE_SENSOR = 7;
var ADDR_TYPE_OPENTHERM = 10;
var ADDR_TYPE_RELAY = 13;
var ADDR_TYPE_GATEWAY = 18;
var ADDR_TYPE_REMOTE = 30;

function Message(parsed, config) {
    if (!(this instanceof Message)) return new Message(parsed, config);

    this.parsed = parsed;
    this.config = config;
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
    var result = this.parsed.payload.bytes.readUInt8(this.p);
    this.p += 1;
    return result;
}

function Address(addr, controllers) {
    if (!(this instanceof Address)) return new Address(addr);
    this.addr = addr;
    this.controllers = controllers;
    this.type = +(this.addr.substr(0, 2));
}

Address.prototype.toString = function() {
    return this.addr;
}

Address.prototype.isSiteController = function() {
    return this.isController() && this.controllers.includes(this.addr);
}

Address.prototype.isController = function() { return this.type === ADDR_TYPE_CONTROLLER; }
Address.prototype.isZone = function() { return this.type === ADDR_TYPE_ZONE; }
Address.prototype.isSensor = function() { return this.type === ADDR_TYPE_SENSOR; }
Address.prototype.isOpenTherm = function() { return this.type === ADDR_TYPE_OPENTHERM; }
Address.prototype.isRelay = function() { return this.type === ADDR_TYPE_RELAY; }
Address.prototype.isGateway = function() { return this.type === ADDR_TYPE_GATEWAY; }
Address.prototype.isRemote = function() { return this.type === ADDR_TYPE_REMOTE; }

module.exports = Message;

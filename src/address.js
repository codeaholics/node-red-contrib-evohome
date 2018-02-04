const ADDR_TYPE_CONTROLLER = '01';
const ADDR_TYPE_ZONE = '04';
const ADDR_TYPE_SENSOR = '07';
const ADDR_TYPE_OPENTHERM = '10';
const ADDR_TYPE_RELAY = '13';
const ADDR_TYPE_GATEWAY = '18';
const ADDR_TYPE_REMOTE = '30';
// TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/3

const TYPE_NAMES = {
    [ADDR_TYPE_CONTROLLER]: 'controller',
    [ADDR_TYPE_ZONE]: 'zone',
    [ADDR_TYPE_SENSOR]: 'sensor',
    [ADDR_TYPE_OPENTHERM]: 'opentherm',
    [ADDR_TYPE_RELAY]: 'relay',
    [ADDR_TYPE_GATEWAY]: 'gateway',
    [ADDR_TYPE_REMOTE]: 'remote'
};

function Address(addr, config) {
    if (!(this instanceof Address)) return new Address(addr);
    this.addr = addr;
    this.config = config;
    this.type = this.addr.substr(0, 2);
}

Address.prototype.toString = function() {
    return this.addr;
};

Address.prototype.describe = function() {
    const device = this.config.devices[this.addr];
    const type = TYPE_NAMES[this.type] || 'unknown';
    const name = (device && device.name) || 'unknown';
    const zone = (device && device.zone) || -1;
    const zoneName = (device && device.zone && this.config.zones[device.zone]) || 'unknown';

    return {
        addr: this.addr,
        type,
        name,
        zone,
        zoneName
    };
};

Address.prototype.isConfigured = function() {
    return this.addr in this.config.devices;
};

Address.prototype.isSiteController = function() {
    return this.isController() && this.config.controllers.includes(this.addr);
};

Address.prototype.isController = function() { return this.type === ADDR_TYPE_CONTROLLER; };
Address.prototype.isZone = function() { return this.type === ADDR_TYPE_ZONE; };
Address.prototype.isSensor = function() { return this.type === ADDR_TYPE_SENSOR; };
Address.prototype.isOpenTherm = function() { return this.type === ADDR_TYPE_OPENTHERM; };
Address.prototype.isRelay = function() { return this.type === ADDR_TYPE_RELAY; };
Address.prototype.isGateway = function() { return this.type === ADDR_TYPE_GATEWAY; };
Address.prototype.isRemote = function() { return this.type === ADDR_TYPE_REMOTE; };

module.exports = Address;

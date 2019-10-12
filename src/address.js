const ADDR_TYPE_CONTROLLER = '01';
const ADDR_TYPE_ZONE = '04';
const ADDR_TYPE_SENSOR = '07';
const ADDR_TYPE_OPENTHERM = '10';
const ADDR_TYPE_RELAY = '13';
const ADDR_TYPE_GATEWAY = '18';
const ADDR_TYPE_DTS92_THERMOSTAT = '22';
const ADDR_TYPE_REMOTE = '30';
const ADDR_TYPE_T87RF_THERMOSTAT = '34';
// TODO https://github.com/codeaholics/node-red-contrib-evohome/issues/3

const TYPE_NAMES = {
    [ADDR_TYPE_CONTROLLER]: 'controller',
    [ADDR_TYPE_ZONE]: 'zone',
    [ADDR_TYPE_SENSOR]: 'sensor',
    [ADDR_TYPE_OPENTHERM]: 'opentherm',
    [ADDR_TYPE_RELAY]: 'relay',
    [ADDR_TYPE_GATEWAY]: 'gateway',
    [ADDR_TYPE_DTS92_THERMOSTAT]: 'thermostat',
    [ADDR_TYPE_REMOTE]: 'remote',
    [ADDR_TYPE_T87RF_THERMOSTAT]: 'thermostat'
};

function Address(addr, config) {
    if (!(this instanceof Address)) return new Address(addr, config);

    this.addr = addr;
    this.config = config;
    this.type = this.addr.substr(0, 2);
}

Address.prototype.toString = function() {
    return this.addr;
};

Address.prototype.describe = function() {
    const result = {
        addr: this.addr
    };

    const type = TYPE_NAMES[this.type];
    if (type) result.type = type;

    const device = this.config.findDevice(this.addr);
    if (device) {
        if (device.name) result.name = device.name;
        if (device.zone !== undefined) result.zone = device.zone;
        if (device.zoneName) result.zoneName = device.zoneName;
    }

    return result;
};

Address.prototype.isConfigured = function() {
    return this.config.isConfiguredDevice(this.addr);
};

Address.prototype.isSiteController = function() {
    return this.isController() && this.config.isSiteController(this.addr);
};

Address.prototype.isController = function() { return this.type === ADDR_TYPE_CONTROLLER; };
Address.prototype.isZone = function() { return this.type === ADDR_TYPE_ZONE; };
Address.prototype.isSensor = function() { return this.type === ADDR_TYPE_SENSOR; };
Address.prototype.isOpenTherm = function() { return this.type === ADDR_TYPE_OPENTHERM; };
Address.prototype.isRelay = function() { return this.type === ADDR_TYPE_RELAY; };
Address.prototype.isGateway = function() { return this.type === ADDR_TYPE_GATEWAY; };
Address.prototype.isRemote = function() { return this.type === ADDR_TYPE_REMOTE; };
Address.prototype.isThermostat = function() {
    return this.type === ADDR_TYPE_T87RF_THERMOSTAT || this.type === ADDR_TYPE_DTS92_THERMOSTAT;
};

module.exports = Address;

function Config(rawConfig) {
    if (!(this instanceof Config)) return new Config(rawConfig);

    // Allow either a single controller object or an array of them
    rawConfig = [].concat(rawConfig);

    this.allDevices = {};
    this.allControllers = {};

    rawConfig.forEach((site) => {
        this.allControllers[site.controller] = {
            zones: site.zones
        };

        Object.getOwnPropertyNames(site.devices).forEach((addr) => {
            this.allDevices[addr] = Object.freeze({
                name: site.devices[addr].name,
                zone: site.devices[addr].zone,
                zoneName: site.zones[site.devices[addr].zone]
            });
        });
    });
}

Config.prototype.isConfiguredDevice = function(addr) {
    return addr in this.allDevices;
};

Config.prototype.isSiteController = function(addr) {
    return addr in this.allControllers;
};

Config.prototype.findDevice = function(addr) {
    return this.allDevices[addr];
};

Config.prototype.findZoneName = function(controllerAddr, zone) {
    return this.allControllers[controllerAddr].zones[zone];
};

module.exports = Config;

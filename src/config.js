class Config {
    constructor(rawConfig) {
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

    isConfiguredDevice(addr) {
        return addr in this.allDevices;
    }

    isSiteController(addr) {
        return addr in this.allControllers;
    }

    findDevice(addr) {
        return this.allDevices[addr];
    }

    findZoneName(controllerAddr, zone) {
        return this.allControllers[controllerAddr].zones[zone];
    }
}

export default Config;

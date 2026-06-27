class Config {
    #allDevices = {};

    #allControllers = {};

    constructor(rawConfig) {
        [].concat(rawConfig).forEach((site) => {
            this.#allControllers[site.controller] = {zones: site.zones, relays: site.relays};

            Object.getOwnPropertyNames(site.devices).forEach((addr) => {
                this.#allDevices[addr] = Object.freeze({
                    name: site.devices[addr].name,
                    zone: site.devices[addr].zone,
                    zoneName: site.zones[site.devices[addr].zone]
                });
            });

            if (site.relays) {
                if (site.relays.dhw) {
                    this.#allDevices[site.relays.dhw] = Object.freeze({name: 'Hot Water', subsystem: 'dhw'});
                }
                if (site.relays.boiler) {
                    this.#allDevices[site.relays.boiler] = Object.freeze({name: 'Boiler', subsystem: 'boiler'});
                }
            }

            if (site.opentherm) {
                this.#allDevices[site.opentherm] = Object.freeze({name: 'OpenTherm', subsystem: 'opentherm'});
            }
        });
    }

    isConfiguredDevice(addr) { return addr in this.#allDevices; }

    isSiteController(addr) { return addr in this.#allControllers; }

    findDevice(addr) { return this.#allDevices[addr]; }

    findZoneName(controllerAddr, zone) { return this.#allControllers[controllerAddr].zones[zone]; }
}

module.exports = Config;

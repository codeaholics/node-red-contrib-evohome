import {expect, describe, test} from 'vitest';
import Config from '../src/config';
import {
    makeConfig, randomControllerAddr, randomZoneAddr, randomRelayAddr, randomOpenThermAddr
} from './helpers';

const CONTROLLER = randomControllerAddr();
const ZONE_DEVICE = randomZoneAddr();
const DHW_RELAY = randomRelayAddr();
const BOILER_RELAY = randomRelayAddr();
const OPENTHERM = randomOpenThermAddr();

function withDefaults(overrides = {}) {
    return makeConfig(CONTROLLER, {
        zones: {1: 'Living Room', 2: 'Bedroom'},
        devices: {[ZONE_DEVICE]: {name: 'Hallway Sensor', zone: 1}},
        ...overrides
    });
}

describe('Config', () => {
    describe('isConfiguredDevice()', () => {
        test('true for a known device', () => {
            expect(withDefaults().isConfiguredDevice(ZONE_DEVICE)).toBe(true);
        });

        test('false for an unknown address', () => {
            expect(withDefaults().isConfiguredDevice(randomZoneAddr())).toBe(false);
        });

        test('false for the controller address (not in allDevices)', () => {
            expect(withDefaults().isConfiguredDevice(CONTROLLER)).toBe(false);
        });
    });

    describe('isSiteController()', () => {
        test('true for the configured controller', () => {
            expect(withDefaults().isSiteController(CONTROLLER)).toBe(true);
        });

        test('false for a device address', () => {
            expect(withDefaults().isSiteController(ZONE_DEVICE)).toBe(false);
        });

        test('false for an unknown controller address', () => {
            expect(withDefaults().isSiteController(randomControllerAddr())).toBe(false);
        });
    });

    describe('findDevice()', () => {
        test('returns undefined for an unknown address', () => {
            expect(withDefaults().findDevice(randomZoneAddr())).toBeUndefined();
        });

        test('zone device has name, zone, and zoneName', () => {
            const device = withDefaults().findDevice(ZONE_DEVICE);
            expect(device.name).toBe('Hallway Sensor');
            expect(device.zone).toBe(1);
            expect(device.zoneName).toBe('Living Room');
        });

        test('zone device is frozen', () => {
            expect(Object.isFrozen(withDefaults().findDevice(ZONE_DEVICE))).toBe(true);
        });

        test('zone device with zone not in zones map has undefined zoneName', () => {
            const orphan = randomZoneAddr();
            const cfg = makeConfig(CONTROLLER, {
                zones: {},
                devices: {[orphan]: {name: 'Orphan', zone: 99}}
            });
            expect(cfg.findDevice(orphan).zoneName).toBeUndefined();
        });
    });

    describe('relay devices', () => {
        const cfg = withDefaults({relays: {dhw: DHW_RELAY, boiler: BOILER_RELAY}});

        test('DHW relay is registered as Hot Water', () => {
            const device = cfg.findDevice(DHW_RELAY);
            expect(device.name).toBe('Hot Water');
            expect(device.subsystem).toBe('dhw');
        });

        test('boiler relay is registered as Boiler', () => {
            const device = cfg.findDevice(BOILER_RELAY);
            expect(device.name).toBe('Boiler');
            expect(device.subsystem).toBe('boiler');
        });

        test('DHW relay is configured', () => {
            expect(cfg.isConfiguredDevice(DHW_RELAY)).toBe(true);
        });

        test('only dhw relay — no boiler crash', () => {
            const c = withDefaults({relays: {dhw: DHW_RELAY}});
            expect(c.findDevice(DHW_RELAY).name).toBe('Hot Water');
            expect(c.findDevice(BOILER_RELAY)).toBeUndefined();
        });

        test('no relays section — no crash', () => {
            expect(() => withDefaults({relays: undefined})).not.toThrow();
        });
    });

    describe('opentherm device', () => {
        test('registered when present', () => {
            const cfg = withDefaults({opentherm: OPENTHERM});
            const device = cfg.findDevice(OPENTHERM);
            expect(device.name).toBe('OpenTherm');
            expect(device.subsystem).toBe('opentherm');
        });
    });

    describe('findZoneName()', () => {
        test('returns the zone name for a known controller and zone', () => {
            expect(withDefaults().findZoneName(CONTROLLER, 1)).toBe('Living Room');
            expect(withDefaults().findZoneName(CONTROLLER, 2)).toBe('Bedroom');
        });

        test('throws when controller address is unknown', () => {
            expect(() => withDefaults().findZoneName(randomControllerAddr(), 1)).toThrow();
        });
    });

    describe('controllers()', () => {
        test('returns the single configured controller', () => {
            expect(withDefaults().controllers()).toEqual([CONTROLLER]);
        });

        test('returns every controller in a multi-site config', () => {
            const A = randomControllerAddr();
            const B = randomControllerAddr();
            const cfg = new Config([
                {controller: A, zones: {}, devices: {}},
                {controller: B, zones: {}, devices: {}}
            ]);
            expect(cfg.controllers()).toEqual([A, B]);
        });
    });

    describe('zones()', () => {
        test('returns the 1-based zone numbers for a controller', () => {
            expect(withDefaults().zones(CONTROLLER)).toEqual([1, 2]);
        });

        test('returns an empty array when no zones are configured', () => {
            expect(makeConfig(CONTROLLER, {zones: {}}).zones(CONTROLLER)).toEqual([]);
        });

        test('throws for an unknown controller', () => {
            expect(() => withDefaults().zones(randomControllerAddr())).toThrow();
        });
    });

    describe('hasDhw()', () => {
        test('true when the controller has a DHW relay configured', () => {
            const cfg = withDefaults({relays: {dhw: DHW_RELAY}});
            expect(cfg.hasDhw(CONTROLLER)).toBe(true);
        });

        test('false when the controller has relays but no DHW', () => {
            const cfg = withDefaults({relays: {boiler: BOILER_RELAY}});
            expect(cfg.hasDhw(CONTROLLER)).toBe(false);
        });

        test('false when the controller has no relays section', () => {
            expect(withDefaults({relays: undefined}).hasDhw(CONTROLLER)).toBe(false);
        });

        test('false for an unknown controller', () => {
            expect(withDefaults().hasDhw(randomControllerAddr())).toBe(false);
        });
    });

    describe('multi-site (array of configs)', () => {
        const CONTROLLER_B = randomControllerAddr();
        const DEVICE_A = randomZoneAddr();
        const DEVICE_B = randomZoneAddr();

        const cfg = new Config([
            {
                controller: CONTROLLER,
                zones: {1: 'Living Room'},
                devices: {[DEVICE_A]: {name: 'Sensor A', zone: 1}}
            },
            {
                controller: CONTROLLER_B,
                zones: {1: 'Kitchen'},
                devices: {[DEVICE_B]: {name: 'Sensor B', zone: 1}}
            }
        ]);

        test('devices from both sites are accessible', () => {
            expect(cfg.findDevice(DEVICE_A).name).toBe('Sensor A');
            expect(cfg.findDevice(DEVICE_B).name).toBe('Sensor B');
        });

        test('both controllers are recognised as site controllers', () => {
            expect(cfg.isSiteController(CONTROLLER)).toBe(true);
            expect(cfg.isSiteController(CONTROLLER_B)).toBe(true);
        });

        test('findZoneName works for both controllers', () => {
            expect(cfg.findZoneName(CONTROLLER, 1)).toBe('Living Room');
            expect(cfg.findZoneName(CONTROLLER_B, 1)).toBe('Kitchen');
        });
    });
});

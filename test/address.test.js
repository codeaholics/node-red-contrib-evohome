import {expect, describe, test} from 'vitest';
import Address from '../src/address';
import {
    makeConfig,
    randomControllerAddr, randomZoneAddr, randomSensorAddr,
    randomOpenThermAddr, randomRelayAddr, randomGatewayAddr,
    randomDts92Addr, randomRemoteAddr, randomT87rfAddr,
} from './helpers';

const CONTROLLER = randomControllerAddr();
const ZONE_DEVICE = randomZoneAddr();
const UNCONFIGURED = randomZoneAddr();
const config = makeConfig(CONTROLLER, {
    zones: {1: 'Living Room'},
    devices: {[ZONE_DEVICE]: {name: 'Hallway Sensor', zone: 1}},
});

function addr(a, cfg = config) {
    return new Address(a, cfg);
}

describe('toString()', () => {
    test('returns the address string', () => {
        expect(addr(ZONE_DEVICE).toString()).toBe(ZONE_DEVICE);
    });
});

describe('type predicates', () => {
    test('isController()', () => {
        expect(addr(randomControllerAddr()).isController()).toBe(true);
        expect(addr(randomZoneAddr()).isController()).toBe(false);
    });

    test('isZone()', () => {
        expect(addr(randomZoneAddr()).isZone()).toBe(true);
        expect(addr(randomControllerAddr()).isZone()).toBe(false);
    });

    test('isSensor()', () => {
        expect(addr(randomSensorAddr()).isSensor()).toBe(true);
        expect(addr(randomZoneAddr()).isSensor()).toBe(false);
    });

    test('isOpenTherm()', () => {
        expect(addr(randomOpenThermAddr()).isOpenTherm()).toBe(true);
        expect(addr(randomZoneAddr()).isOpenTherm()).toBe(false);
    });

    test('isRelay()', () => {
        expect(addr(randomRelayAddr()).isRelay()).toBe(true);
        expect(addr(randomZoneAddr()).isRelay()).toBe(false);
    });

    test('isGateway()', () => {
        expect(addr(randomGatewayAddr()).isGateway()).toBe(true);
        expect(addr(randomZoneAddr()).isGateway()).toBe(false);
    });

    test('isRemote()', () => {
        expect(addr(randomRemoteAddr()).isRemote()).toBe(true);
        expect(addr(randomZoneAddr()).isRemote()).toBe(false);
    });

    test('isThermostat() matches both DTS92 (22) and T87RF (34)', () => {
        expect(addr(randomDts92Addr()).isThermostat()).toBe(true);
        expect(addr(randomT87rfAddr()).isThermostat()).toBe(true);
        expect(addr(randomZoneAddr()).isThermostat()).toBe(false);
    });
});

describe('isConfigured()', () => {
    test('true for a device in the config', () => {
        expect(addr(ZONE_DEVICE).isConfigured()).toBe(true);
    });

    test('false for an unknown address', () => {
        expect(addr(UNCONFIGURED).isConfigured()).toBe(false);
    });
});

describe('isSiteController()', () => {
    test('true for the site controller', () => {
        expect(addr(CONTROLLER).isSiteController()).toBe(true);
    });

    test('false for a controller not in the config', () => {
        expect(addr(randomControllerAddr()).isSiteController()).toBe(false);
    });

    test('false for a non-controller address', () => {
        expect(addr(ZONE_DEVICE).isSiteController()).toBe(false);
    });
});

describe('describe()', () => {
    test('known type, unconfigured device — addr and type only', () => {
        expect(addr(UNCONFIGURED).describe()).toEqual({
            addr: UNCONFIGURED,
            type: 'zone',
        });
    });

    test('configured device — includes name, zone, and zoneName', () => {
        expect(addr(ZONE_DEVICE).describe()).toEqual({
            addr: ZONE_DEVICE,
            type: 'zone',
            name: 'Hallway Sensor',
            zone: 1,
            zoneName: 'Living Room',
        });
    });

    test('unknown address type — addr only, no type field', () => {
        expect(addr('--:------').describe()).toEqual({addr: '--:------'});
    });

    test('zone=0 is included (falsy but not undefined)', () => {
        const device = randomZoneAddr();
        const cfg = makeConfig(CONTROLLER, {
            zones: {0: 'Ground Floor'},
            devices: {[device]: {name: 'Sensor', zone: 0}},
        });
        expect(addr(device, cfg).describe().zone).toBe(0);
    });

    test('relay device — name included, zone and zoneName absent', () => {
        const relay = randomRelayAddr();
        const cfg = makeConfig(CONTROLLER, {relays: {dhw: relay}});
        expect(addr(relay, cfg).describe()).toEqual({
            addr: relay,
            type: 'relay',
            name: 'Hot Water',
        });
    });
});

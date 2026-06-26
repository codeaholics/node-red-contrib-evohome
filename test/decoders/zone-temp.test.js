import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/zone-temp';
import {randomControllerAddr, randomZoneAddr, makeConfig, makeMessage} from '../helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER, {zones: {1: 'Living Room', 2: 'Bedroom'}});

// 21.00°C = 2100 = 0x0834
// 24.12°C = 2412 = 0x096C

function msg(type, addr0, payload) {
    return makeMessage({
        type, cmd: '30C9', addr0, addr2: CONTROLLER, payload,
    }, config);
}

describe('zone-temp decoder (30C9)', () => {
    test('single temperature from zone device', () => {
        const results = decode(msg('I', ZONE, '000834'), config);
        expect(results).toHaveLength(1);
        expect(results[0].decoded.type).toBe('ZONE_TEMP');
        expect(results[0].decoded.temperature).toBe(21.00);
        expect(results[0].decoded.device.addr).toBe(ZONE);
    });

    test('multiple temperatures from controller', () => {
        const results = decode(msg('I', CONTROLLER, '00083401096C'), config);
        expect(results).toHaveLength(2);
        expect(results[0].decoded.zone).toBe(1);
        expect(results[0].decoded.zoneName).toBe('Living Room');
        expect(results[0].decoded.temperature).toBe(21.00);
        expect(results[1].decoded.zone).toBe(2);
        expect(results[1].decoded.zoneName).toBe('Bedroom');
        expect(results[1].decoded.temperature).toBe(24.12);
    });

    test('skips 0x7FFF (no reading) entries', () => {
        const results = decode(msg('I', CONTROLLER, '000834017FFF'), config);
        expect(results).toHaveLength(1);
        expect(results[0].decoded.zone).toBe(1);
    });

    test('returns empty array when all readings are 0x7FFF', () => {
        const results = decode(msg('I', CONTROLLER, '007FFF'), config);
        expect(results).toHaveLength(0);
    });

    test('returns null for RQ with 1-byte payload', () => {
        expect(decode(msg('RQ', ZONE, '00'))).toBeNull();
    });

    test('throws for payload shorter than 3 bytes', () => {
        expect(() => decode(msg('I', ZONE, '0000'))).toThrow('payload too short');
    });

    test('throws for payload length not divisible by 3', () => {
        expect(() => decode(msg('I', ZONE, '00083400'))).toThrow('payload invalid length');
    });

    test('throws when non-controller sends multiple temperatures', () => {
        expect(() => decode(msg('I', ZONE, '00083401096C'))).toThrow('incorrect payload length');
    });
});

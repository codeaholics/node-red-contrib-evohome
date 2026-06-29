import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/setpoint';
import {
    randomControllerAddr, randomZoneAddr, makeConfig, makeMessage
} from '../helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER, {zones: {1: 'Living Room', 2: 'Bedroom'}});

// 21.00°C = 2100 = 0x0834
// 24.12°C = 2412 = 0x096C

function msg(type, addr0, payload) {
    return makeMessage({
        type, cmd: '2309', addr0, addr2: CONTROLLER, payload
    }, config);
}

describe('setpoint decoder (2309)', () => {
    test('single setpoint from zone device', () => {
        const results = decode(msg('I', ZONE, '000834'), config);
        expect(results).toHaveLength(1);
        expect(results[0].decoded.type).toBe('SETPOINT');
        expect(results[0].decoded.setpoint).toBe(21.00);
        expect(results[0].decoded.device.addr).toBe(ZONE);
    });

    test('multiple setpoints from controller include zone and zoneName', () => {
        const results = decode(msg('I', CONTROLLER, '00083401096C'), config);
        expect(results).toHaveLength(2);
        expect(results[0].decoded.zone).toBe(1);
        expect(results[0].decoded.zoneName).toBe('Living Room');
        expect(results[0].decoded.setpoint).toBe(21.00);
        expect(results[1].decoded.zone).toBe(2);
        expect(results[1].decoded.zoneName).toBe('Bedroom');
        expect(results[1].decoded.setpoint).toBe(24.12);
    });

    test('skips 0x7FFF (no reading) entries', () => {
        const results = decode(msg('I', CONTROLLER, '007FFF'), config);
        expect(results).toHaveLength(0);
    });

    test('returns null for RQ with 1-byte payload', () => {
        expect(decode(msg('RQ', ZONE, '00'))).toBeNull();
    });

    test('decodes a reply (RP) from the controller', () => {
        const results = decode(msg('RP', CONTROLLER, '000834'), config);
        expect(results).toHaveLength(1);
        expect(results[0].decoded.setpoint).toBe(21.00);
    });

    test('ignores a write (W) — only I and RP are readings', () => {
        expect(decode(msg('W', CONTROLLER, '000834'), config)).toBeNull();
    });

    test('deduplicates, keyed by controller and zone index (not zoneName)', () => {
        const dedup = decode(msg('I', CONTROLLER, '000834'), config)[0].deduplication;
        expect(dedup.key.split(';')).toEqual(['SETPOINT', CONTROLLER, '1']);
        expect(dedup.value).toBe(21.00);
        expect(dedup.seconds).toBe(900);
    });
});

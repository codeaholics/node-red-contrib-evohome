import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/heat-demand';
import {randomControllerAddr, randomZoneAddr, makeConfig, makeMessage} from '../helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER);

// Payload: [zone-byte, demand-byte]  demand = byte / 2
// Zone < 12 → 'zone'; 249=ch, 250=dhw, 252=boiler; else 'unknown N'
// 0xC8 = 200 → demand = 100

function msg(payload) {
    return makeMessage({
        type: 'I', cmd: '3150', addr0: ZONE, addr2: CONTROLLER, payload,
    }, config);
}

describe('heat-demand decoder (3150/0008)', () => {
    test('zone subsystem for zone byte 0', () => {
        const result = decode(msg('00C8'));
        expect(result.decoded.type).toBe('HEAT_DEMAND');
        expect(result.decoded.subsystem).toBe('zone');
        expect(result.decoded.demand).toBe(100);
    });

    test('zone subsystem for zone byte 11 (upper boundary)', () => {
        expect(decode(msg('0BC8')).decoded.subsystem).toBe('zone');
    });

    test('zone subsystem includes deduplication', () => {
        const result = decode(msg('00C8'));
        expect(result.deduplication).toBeDefined();
        expect(result.deduplication.key).toContain(ZONE);
        expect(result.deduplication.seconds).toBe(120);
    });

    test('ch subsystem (zone byte 249)', () => {
        const result = decode(msg('F9C8'));
        expect(result.decoded.subsystem).toBe('ch');
        expect(result.deduplication).toBeUndefined();
    });

    test('dhw subsystem (zone byte 250)', () => {
        expect(decode(msg('FAC8')).decoded.subsystem).toBe('dhw');
    });

    test('boiler subsystem (zone byte 252)', () => {
        expect(decode(msg('FCC8')).decoded.subsystem).toBe('boiler');
    });

    test('unknown subsystem for unrecognised zone byte', () => {
        expect(decode(msg('0DC8')).decoded.subsystem).toBe('unknown 13');
    });

    test('demand calculation (0x64 → 50)', () => {
        expect(decode(msg('0064')).decoded.demand).toBe(50);
    });

    test('throws on wrong payload length', () => {
        expect(() => decode(msg('00C800'))).toThrow('HEAT_DEMAND payload length incorrect');
    });
});

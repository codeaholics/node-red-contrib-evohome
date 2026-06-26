import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/zone-window';
import {randomControllerAddr, randomZoneAddr, randomSensorAddr, makeConfig, makeMessage} from './helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const SENSOR = randomSensorAddr();
const config = makeConfig(CONTROLLER);

function msg(type, addr0, addr2, payload) {
    return makeMessage({
        type, cmd: '12B0', addr0, addr2, payload,
    }, config);
}

describe('zone-window decoder (12B0)', () => {
    test('window fully open', () => {
        const result = decode(msg('I', ZONE, CONTROLLER, '06C800'));
        expect(result.decoded.type).toBe('ZONE_WINDOW');
        expect(result.decoded.windowOpen).toBe(100);
        expect(result.decoded.device.addr).toBe(ZONE);
        expect(result.decoded.device.type).toBe('zone');
    });

    test('window closed', () => {
        expect(decode(msg('I', ZONE, CONTROLLER, '060000')).decoded.windowOpen).toBe(0);
    });

    test('window half open', () => {
        // 0x64 = 100 → 100 / 2 = 50
        expect(decode(msg('I', ZONE, CONTROLLER, '066400')).decoded.windowOpen).toBe(50);
    });

    test('returns null when addr[0] is not a zone', () => {
        expect(decode(msg('I', SENSOR, CONTROLLER, '06C800'))).toBeNull();
    });

    test('returns null when addr[2] is not the site controller', () => {
        expect(decode(msg('I', ZONE, ZONE, '06C800'))).toBeNull();
    });

    test('returns null for non-information message type', () => {
        expect(decode(msg('RP', ZONE, CONTROLLER, '06C800'))).toBeNull();
    });

    test('throws on wrong payload length', () => {
        const m = msg('I', ZONE, CONTROLLER, '06C80000');
        expect(() => decode(m)).toThrow('ZONE_WINDOW payload length incorrect');
    });
});

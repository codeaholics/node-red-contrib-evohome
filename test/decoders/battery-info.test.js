import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/battery-info';
import {randomControllerAddr, randomSensorAddr, randomZoneAddr, makeConfig, makeMessage} from '../helpers';

const CONTROLLER = randomControllerAddr();
const SENSOR = randomSensorAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER);

function msg(addr0, addr2, payload) {
    return makeMessage({
        type: 'I', cmd: '1060', addr0, addr2, payload,
    }, config);
}

describe('battery-info decoder (1060)', () => {
    // Payload: [zone-skip, battery-level, battery-ok]
    // battery-ok=0 → dead; battery-level=255 → full; otherwise level/2

    test('full battery (level=255, ok=1) → 100%', () => {
        const result = decode(msg(SENSOR, CONTROLLER, '00FF01'));
        expect(result.decoded.type).toBe('BATTERY_INFO');
        expect(result.decoded.batteryLevel).toBe(100);
        expect(result.decoded.device.addr).toBe(SENSOR);
    });

    test('partial battery (level=100, ok=1) → 50%', () => {
        const result = decode(msg(SENSOR, CONTROLLER, '006401'));
        expect(result.decoded.batteryLevel).toBe(50);
    });

    test('battery ok=0 → 0% regardless of level', () => {
        const result = decode(msg(SENSOR, CONTROLLER, '00FF00'));
        expect(result.decoded.batteryLevel).toBe(0);
    });

    test('returns null when neither sensor nor site controller', () => {
        expect(decode(msg(ZONE, ZONE, '00FF01'))).toBeNull();
    });

    test('deduplication key includes device address', () => {
        const result = decode(msg(SENSOR, CONTROLLER, '00FF01'));
        expect(result.deduplication.key).toContain(SENSOR);
        expect(result.deduplication.value).toBe(100);
        expect(result.deduplication.seconds).toBe(3600);
    });

    test('throws on wrong payload length', () => {
        expect(() => decode(msg(SENSOR, CONTROLLER, '00FF0100'))).toThrow('BATTERY_INFO payload length incorrect');
    });
});

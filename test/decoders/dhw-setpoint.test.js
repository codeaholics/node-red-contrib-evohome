import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/dhw-setpoint';
import {
    randomControllerAddr, randomSensorAddr, makeConfig, makeMessage
} from '../helpers';

const CONTROLLER = randomControllerAddr();
const SENSOR = randomSensorAddr();
const config = makeConfig(CONTROLLER);

// Payload: devno(1) setpoint(2) overrun(1) differential(2)
function msg(type, addr0, payload) {
    return makeMessage({
        type, cmd: '10A0', addr0, addr1: addr0 === CONTROLLER ? SENSOR : CONTROLLER, payload
    }, config);
}

describe('DHW setpoint decoder (10A0)', () => {
    test('decodes setpoint and differential from a broadcast (I)', () => {
        // 1770 = 60.00°C, 01F4 = 5.00°C
        const result = decode(msg('I', CONTROLLER, '0017700001F4'), config);
        expect(result.decoded.type).toBe('DHW_SETPOINT');
        expect(result.decoded.setpoint).toBe(60.00);
        expect(result.decoded.differential).toBe(5.00);
        expect(result.decoded.device.addr).toBe(CONTROLLER);
    });

    test('decodes a reply (RP) from the controller', () => {
        const result = decode(msg('RP', CONTROLLER, '0017700001F4'), config);
        expect(result.decoded.setpoint).toBe(60.00);
    });

    test('returns null for a request (RQ) from the sensor', () => {
        expect(decode(msg('RQ', SENSOR, '0017580001F2'), config)).toBeNull();
    });

    test('returns null for a non-controller source', () => {
        expect(decode(msg('I', SENSOR, '0017700001F4'), config)).toBeNull();
    });

    test('throws on an invalid payload length', () => {
        expect(() => decode(msg('I', CONTROLLER, '001770'), config)).toThrow('incorrect payload length');
    });

    test('dedup keyed by controller, value combines setpoint and differential', () => {
        const dedup = decode(msg('I', CONTROLLER, '0017700001F4'), config).deduplication;
        expect(dedup.key).toBe(`DHW_SETPOINT;${CONTROLLER}`);
        expect(dedup.value).toBe('60;5');
        expect(dedup.seconds).toBe(3600);
    });
});

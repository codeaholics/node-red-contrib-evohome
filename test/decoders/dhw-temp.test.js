import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/dhw-temp';
import {
    randomControllerAddr, randomZoneAddr, randomSensorAddr, makeConfig, makeMessage
} from '../helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const SENSOR = randomSensorAddr();
const config = makeConfig(CONTROLLER);

// 0x1827 = 6183 → 61.83°C
const TEMP_PAYLOAD = '001827';
// 0x7FFF = no reading
const NO_READING_PAYLOAD = '007FFF';

describe('dhw-temp decoder (1260)', () => {
    describe('RP from site controller', () => {
        function msg(addr0, payload) {
            return makeMessage({
                type: 'RP', cmd: '1260', addr0, addr2: addr0, payload,
            }, config);
        }

        test('decodes temperature', () => {
            const result = decode(msg(CONTROLLER, TEMP_PAYLOAD));
            expect(result.decoded.type).toBe('DHW_TEMP');
            expect(result.decoded.temperature).toBeCloseTo(61.83);
            expect(result.decoded.device.addr).toBe(CONTROLLER);
        });

        test('returns null for no-reading value (0x7FFF)', () => {
            expect(decode(msg(CONTROLLER, NO_READING_PAYLOAD))).toBeNull();
        });

        test('returns null when addr[0] is not site controller', () => {
            expect(decode(msg(SENSOR, TEMP_PAYLOAD))).toBeNull();
        });
    });

    describe('I from sensor', () => {
        function msg(addr0, payload) {
            return makeMessage({
                type: 'I', cmd: '1260', addr0, addr2: addr0, payload,
            }, config);
        }

        test('decodes temperature', () => {
            const result = decode(msg(SENSOR, TEMP_PAYLOAD));
            expect(result.decoded.type).toBe('DHW_TEMP');
            expect(result.decoded.temperature).toBeCloseTo(61.83);
            expect(result.decoded.device.addr).toBe(SENSOR);
        });

        test('returns null for no-reading value (0x7FFF)', () => {
            expect(decode(msg(SENSOR, NO_READING_PAYLOAD))).toBeNull();
        });

        test('returns null when addr[0] is not a sensor', () => {
            expect(decode(msg(ZONE, TEMP_PAYLOAD))).toBeNull();
        });
    });
});

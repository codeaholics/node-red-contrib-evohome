import {expect, describe, test} from 'vitest';
import parse from '../../src/proto/hgi-parser';
import Message from '../../src/message';
import decode from '../../src/decoders/dhw-temp';

const CONTROLLER = '01:583719';
const SENSOR = '07:028107';
const ZONE = '04:391047';

const config = {
    findDevice: () => null,
    isConfiguredDevice: addr => addr !== '--:------',
    isSiteController: addr => addr === CONTROLLER,
};

function makeMessage(str) {
    const {parsed} = parse(str);
    return new Message(parsed, config);
}

// 0x1827 = 6183 → 61.83°C
const TEMP_PAYLOAD = '001827';
// 0x7FFF = no reading
const NO_READING_PAYLOAD = '007FFF';

describe('dhw-temp decoder (1260)', () => {
    describe('RP from site controller', () => {
        function rpMsg(addr0, payload) {
            const len = String(payload.length / 2).padStart(3, '0');
            return `--- RP --- ${addr0} --:------ ${addr0} 1260 ${len} ${payload}`;
        }

        test('decodes temperature', () => {
            const result = decode(makeMessage(rpMsg(CONTROLLER, TEMP_PAYLOAD)));
            expect(result.decoded.type).toBe('DHW_TEMP');
            expect(result.decoded.temperature).toBeCloseTo(61.83);
            expect(result.decoded.device.addr).toBe(CONTROLLER);
        });

        test('returns null for no-reading value (0x7FFF)', () => {
            expect(decode(makeMessage(rpMsg(CONTROLLER, NO_READING_PAYLOAD)))).toBeNull();
        });

        test('returns null when addr[0] is not site controller', () => {
            expect(decode(makeMessage(rpMsg(SENSOR, TEMP_PAYLOAD)))).toBeNull();
        });
    });

    describe('I from sensor', () => {
        function infoMsg(addr0, payload) {
            const len = String(payload.length / 2).padStart(3, '0');
            return `---  I --- ${addr0} --:------ ${addr0} 1260 ${len} ${payload}`;
        }

        test('decodes temperature', () => {
            const result = decode(makeMessage(infoMsg(SENSOR, TEMP_PAYLOAD)));
            expect(result.decoded.type).toBe('DHW_TEMP');
            expect(result.decoded.temperature).toBeCloseTo(61.83);
            expect(result.decoded.device.addr).toBe(SENSOR);
        });

        test('returns null for no-reading value (0x7FFF)', () => {
            expect(decode(makeMessage(infoMsg(SENSOR, NO_READING_PAYLOAD)))).toBeNull();
        });

        test('returns null when addr[0] is not a sensor', () => {
            expect(decode(makeMessage(infoMsg(ZONE, TEMP_PAYLOAD)))).toBeNull();
        });
    });
});

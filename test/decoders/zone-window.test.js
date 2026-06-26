import {expect, describe, test} from 'vitest';
import parse from '../../src/proto/hgi-parser';
import Message from '../../src/message';
import decode from '../../src/decoders/zone-window';

const CONTROLLER = '01:472819';
const ZONE = '04:631054';
const SENSOR = '07:289463';

const config = {
    findDevice: () => null,
    isConfiguredDevice: addr => addr !== '--:------',
    isSiteController: addr => addr === CONTROLLER,
};

function makeMessage(str) {
    const {parsed} = parse(str);
    return new Message(parsed, config);
}

function raw(type, addr0, addr2, payload) {
    const len = String(payload.length / 2).padStart(3, '0');
    return `--- ${type} --- ${addr0} --:------ ${addr2} 12B0 ${len} ${payload}`;
}

describe('zone-window decoder (12B0)', () => {
    test('window fully open', () => {
        const result = decode(makeMessage(raw('I', ZONE, CONTROLLER, '06C800')));
        expect(result.decoded.type).toBe('ZONE_WINDOW');
        expect(result.decoded.windowOpen).toBe(100);
        expect(result.decoded.device.addr).toBe(ZONE);
        expect(result.decoded.device.type).toBe('zone');
    });

    test('window closed', () => {
        const result = decode(makeMessage(raw('I', ZONE, CONTROLLER, '060000')));
        expect(result.decoded.windowOpen).toBe(0);
    });

    test('window half open', () => {
        // 0x64 = 100 → 100 / 2 = 50
        const result = decode(makeMessage(raw('I', ZONE, CONTROLLER, '066400')));
        expect(result.decoded.windowOpen).toBe(50);
    });

    test('returns null when addr[0] is not a zone', () => {
        expect(decode(makeMessage(raw('I', SENSOR, CONTROLLER, '06C800')))).toBeNull();
    });

    test('returns null when addr[2] is not the site controller', () => {
        expect(decode(makeMessage(raw('I', ZONE, ZONE, '06C800')))).toBeNull();
    });

    test('returns null for non-information message type', () => {
        expect(decode(makeMessage(raw('RP', ZONE, CONTROLLER, '06C800')))).toBeNull();
    });

    test('throws on wrong payload length', () => {
        const msg = makeMessage(raw('I', ZONE, CONTROLLER, '06C80000'));
        expect(() => decode(msg)).toThrow('ZONE_WINDOW payload length incorrect');
    });
});

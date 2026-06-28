import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/setpoint-override';
import {
    randomControllerAddr, randomZoneAddr, makeConfig, makeMessage
} from '../helpers';

const CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER, {zones: {1: 'Living Room', 2: 'Bedroom'}});

// 21.00°C = 2100 = 0x0834
// Payload: zone(1) setpoint(2) mode(1) FFFFFF(3) [until-datetime(6)]
function msg(type, addr0, payload) {
    return makeMessage({
        type, cmd: '2349', addr0, addr2: CONTROLLER, payload
    }, config);
}

describe('setpoint override decoder (2349)', () => {
    test('decodes zone, setpoint and permanent mode (7-byte payload)', () => {
        const result = decode(msg('I', CONTROLLER, '00083402FFFFFF'), config);
        expect(result.decoded.type).toBe('SETPOINT_OVERRIDE');
        expect(result.decoded.zone).toBe(1);
        expect(result.decoded.zoneName).toBe('Living Room');
        expect(result.decoded.setpoint).toBe(21.00);
        expect(result.decoded.mode).toBe('Permanent');
        expect(result.decoded.device.addr).toBe(CONTROLLER);
    });

    test('decodes follow-schedule mode', () => {
        const result = decode(msg('I', CONTROLLER, '01083400FFFFFF'), config);
        expect(result.decoded.zone).toBe(2);
        expect(result.decoded.zoneName).toBe('Bedroom');
        expect(result.decoded.mode).toBe('FollowSchedule');
    });

    test('decodes temporary mode with a 13-byte until-time payload', () => {
        const result = decode(msg('I', CONTROLLER, '00083404FFFFFF000000000000'), config);
        expect(result.decoded.mode).toBe('Temporary');
        expect(result.decoded.setpoint).toBe(21.00);
    });

    test('records the mode but omits the setpoint when not set (0x7FFF)', () => {
        // Follow-schedule reply: mode 00, setpoint 7FFF
        const result = decode(msg('I', CONTROLLER, '007FFF00FFFFFF'), config);
        expect(result.decoded.mode).toBe('FollowSchedule');
        expect(result.decoded.zone).toBe(1);
        expect('setpoint' in result.decoded).toBe(false);
    });

    test('returns null for a non-controller source', () => {
        expect(decode(msg('I', ZONE, '00083402FFFFFF'), config)).toBeNull();
    });

    test('returns null for an RQ with a 1-byte payload', () => {
        expect(decode(msg('RQ', CONTROLLER, '00'), config)).toBeNull();
    });

    test('throws on an unexpected mode', () => {
        expect(() => decode(msg('I', CONTROLLER, '00083401FFFFFF'), config)).toThrow('unexpected mode');
    });

    test('throws on an invalid payload length', () => {
        expect(() => decode(msg('I', CONTROLLER, '000834'), config)).toThrow('incorrect payload length');
    });
});

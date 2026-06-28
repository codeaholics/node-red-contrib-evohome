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

    test('decodes a reply (RP) from the controller', () => {
        const result = decode(msg('RP', CONTROLLER, '00083402FFFFFF'), config);
        expect(result.decoded.type).toBe('SETPOINT_OVERRIDE');
        expect(result.decoded.setpoint).toBe(21.00);
    });

    test('ignores a write (W) — only I and RP are readings', () => {
        expect(decode(msg('W', CONTROLLER, '00083402FFFFFF'), config)).toBeNull();
    });

    test('throws on an unexpected mode', () => {
        expect(() => decode(msg('I', CONTROLLER, '00083401FFFFFF'), config)).toThrow('unexpected mode');
    });

    test('throws on an invalid payload length', () => {
        expect(() => decode(msg('I', CONTROLLER, '000834'), config)).toThrow('incorrect payload length');
    });

    describe('deduplication', () => {
        test('keyed by controller and zone index, value combines setpoint and mode', () => {
            const dedup = decode(msg('I', CONTROLLER, '00083402FFFFFF'), config).deduplication;
            expect(dedup.key.split(';')).toEqual(['SETPOINT_OVERRIDE', CONTROLLER, '1']);
            expect(dedup.value).toBe('21;Permanent');
            expect(dedup.seconds).toBe(3600);
        });

        test('renaming a zone does not change the key (zoneName is not part of it)', () => {
            const renamed = makeConfig(CONTROLLER, {zones: {1: 'Lounge', 2: 'Bedroom'}});
            const a = decode(msg('I', CONTROLLER, '00083402FFFFFF'), config);
            const b = decode(msg('I', CONTROLLER, '00083402FFFFFF'), renamed);
            expect(a.decoded.zoneName).toBe('Living Room');
            expect(b.decoded.zoneName).toBe('Lounge');
            expect(a.deduplication.key).toBe(b.deduplication.key);
        });

        test('a mode-only change at the same setpoint still emits (different value)', () => {
            const permanent = decode(msg('I', CONTROLLER, '00083402FFFFFF'), config);
            const temporary = decode(msg('I', CONTROLLER, '00083404FFFFFF000000000000'), config);
            expect(permanent.decoded.setpoint).toBe(temporary.decoded.setpoint);
            expect(permanent.deduplication.value).not.toBe(temporary.deduplication.value);
        });

        test('different zones get different keys', () => {
            const z1 = decode(msg('I', CONTROLLER, '00083402FFFFFF'), config);
            const z2 = decode(msg('I', CONTROLLER, '01083402FFFFFF'), config);
            expect(z1.deduplication.key).not.toBe(z2.deduplication.key);
        });

        test('follow-schedule (no setpoint) yields a stable value', () => {
            const dedup = decode(msg('I', CONTROLLER, '007FFF00FFFFFF'), config).deduplication;
            expect(dedup.value).toBe(';FollowSchedule');
        });
    });
});

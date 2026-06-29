import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/dhw-state';
import {
    randomControllerAddr, randomSensorAddr, makeConfig, makeMessage
} from '../helpers';

const CONTROLLER = randomControllerAddr();
const SENSOR = randomSensorAddr();
const config = makeConfig(CONTROLLER);

// Payload: domain(1) state(1) mode(1) FFFFFF(3) [until-datetime(6)]
function msg(type, addr0, payload) {
    return makeMessage({
        type, cmd: '1F41', addr0, addr1: addr0 === CONTROLLER ? SENSOR : CONTROLLER, payload
    }, config);
}

describe('DHW state decoder (1F41)', () => {
    test('decodes on / follow-schedule (6-byte payload)', () => {
        const result = decode(msg('RP', CONTROLLER, '000100FFFFFF'), config);
        expect(result.decoded.type).toBe('DHW_STATE');
        expect(result.decoded.state).toBe('on');
        expect(result.decoded.mode).toBe('FollowSchedule');
        expect(result.decoded.device.addr).toBe(CONTROLLER);
        expect('until' in result.decoded).toBe(false);
    });

    test('decodes off / permanent', () => {
        const result = decode(msg('I', CONTROLLER, '000002FFFFFF'), config);
        expect(result.decoded.state).toBe('off');
        expect(result.decoded.mode).toBe('Permanent');
    });

    test('decodes a temporary override with an until-time (12-byte payload)', () => {
        // off, temporary, until 2026-06-28 23:00
        const result = decode(msg('I', CONTROLLER, '000004FFFFFF00171C0607EA'), config);
        expect(result.decoded.state).toBe('off');
        expect(result.decoded.mode).toBe('Temporary');
        expect(result.decoded.until).toBe('2026-06-28T23:00:00');
    });

    test('returns null when DHW not installed (state 0xFF)', () => {
        // domain(00) state(FF) mode(00) FFFFFF
        expect(decode(msg('RP', CONTROLLER, '00FF00FFFFFF'), config)).toBeNull();
    });

    test('returns null for a request (RQ)', () => {
        expect(decode(msg('RQ', SENSOR, '00'), config)).toBeNull();
    });

    test('returns null for a non-controller source', () => {
        expect(decode(msg('I', SENSOR, '000100FFFFFF'), config)).toBeNull();
    });

    test('ignores a write (W)', () => {
        expect(decode(msg('W', CONTROLLER, '000100FFFFFF'), config)).toBeNull();
    });

    test('throws on an invalid payload length', () => {
        expect(() => decode(msg('I', CONTROLLER, '0001'), config)).toThrow('incorrect payload length');
    });

    describe('deduplication', () => {
        test('keyed by controller, value combines state, mode and until', () => {
            const dedup = decode(msg('RP', CONTROLLER, '000100FFFFFF'), config).deduplication;
            expect(dedup.key).toBe(`DHW_STATE;${CONTROLLER}`);
            expect(dedup.value).toBe('on;FollowSchedule;');
            expect(dedup.seconds).toBe(3600);
        });

        test('a state change emits a different value', () => {
            const on = decode(msg('I', CONTROLLER, '000100FFFFFF'), config);
            const off = decode(msg('I', CONTROLLER, '000000FFFFFF'), config);
            expect(on.deduplication.value).not.toBe(off.deduplication.value);
        });
    });
});

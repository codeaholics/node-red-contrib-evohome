import {expect, describe, test} from 'vitest';
import decode from '../../src/decoders/actuator-state';
import {randomControllerAddr, randomRelayAddr, randomOpenThermAddr, makeConfig, makeMessage} from '../helpers';

const CONTROLLER = randomControllerAddr();
const RELAY = randomRelayAddr();
const OPENTHERM = randomOpenThermAddr();
const config = makeConfig(CONTROLLER, {devices: {[RELAY]: {name: 'Boiler'}, [OPENTHERM]: {name: 'OT'}}});

// Payloads (each group is 3 bytes):
// [skip, modulation/200, skip, state-byte, skip, skip, ch-enabled-byte, ch-setpoint, skip]
// modulation: 0x64 = 100 → 100/200 = 0.5
// state: 0x0E = 0b00001110 → ch=1, dhw=1, flame=1, cooling=0

describe('actuator-state decoder (3EF0)', () => {
    describe('RP from OpenTherm (addr[0]=opentherm, addr[1]=controller)', () => {
        function msg(payload) {
            return makeMessage({
                type: 'RP', cmd: '3EF0', addr0: OPENTHERM, addr1: CONTROLLER, payload,
            }, config);
        }

        test('3-byte payload decodes modulation', () => {
            const result = decode(msg('006400'));
            expect(result.decoded.type).toBe('ACTUATOR_STATE');
            expect(result.decoded.modulation).toBe(0.5);
            expect(result.decoded.ch).toBeUndefined();
        });

        test('6-byte payload adds ch/dhw/flame/cooling', () => {
            const result = decode(msg('0064000E0000'));
            expect(result.decoded.modulation).toBe(0.5);
            expect(result.decoded.ch).toBe(100);
            expect(result.decoded.dhw).toBe(100);
            expect(result.decoded.flame).toBe(100);
            expect(result.decoded.cooling).toBe(0);
        });

        test('9-byte payload adds chEnabled and chSetpoint', () => {
            const result = decode(msg('0064000E0000013C00'));
            expect(result.decoded.chEnabled).toBe(1);
            expect(result.decoded.chSetpoint).toBe(60);
        });

        test('returns null for RQ', () => {
            expect(decode(makeMessage({
                type: 'RQ', cmd: '3EF0', addr0: OPENTHERM, addr1: CONTROLLER, payload: '00',
            }, config))).toBeNull();
        });

        test('returns null when addr[1] is not site controller', () => {
            expect(decode(makeMessage({
                type: 'RP', cmd: '3EF0', addr0: OPENTHERM, addr1: RELAY, payload: '006400',
            }, config))).toBeNull();
        });
    });

    describe('I from relay or opentherm (configured device)', () => {
        function msg(addr0, payload) {
            return makeMessage({
                type: 'I', cmd: '3EF0', addr0, payload,
            }, config);
        }

        test('relay device decodes modulation', () => {
            const result = decode(msg(RELAY, '006400'));
            expect(result.decoded.type).toBe('ACTUATOR_STATE');
            expect(result.decoded.modulation).toBe(0.5);
        });

        test('opentherm device decodes modulation', () => {
            const result = decode(msg(OPENTHERM, '006400'));
            expect(result.decoded.modulation).toBe(0.5);
        });

        test('returns null for unconfigured device', () => {
            const unconfigured = randomRelayAddr();
            expect(decode(msg(unconfigured, '006400'))).toBeNull();
        });
    });

    test('throws when payload length is not a multiple of 3', () => {
        expect(() => decode(makeMessage({
            type: 'RP', cmd: '3EF0', addr0: OPENTHERM, addr1: CONTROLLER, payload: '006400FF',
        }, config))).toThrow('ACTUATOR_STATE payload length incorrect');
    });
});

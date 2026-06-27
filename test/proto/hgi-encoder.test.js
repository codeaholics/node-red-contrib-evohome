import {expect, describe, test} from 'vitest';
import encode from '../../src/proto/hgi-encoder';
import parse from '../../src/proto/hgi-parser';

const ZONE_TEMP_RQ = {
    type: 'RQ', addr: ['18:000730', '01:123456', '--:------'], cmd: '30C9', payload: '00'
};

describe('hgi-encoder', () => {
    test('encodes a zone temp request', () => {
        expect(encode(ZONE_TEMP_RQ)).toBe('--- RQ --- 18:000730 01:123456 --:------ 30C9 001 00');
    });

    test('computes the length field from the payload', () => {
        const line = encode({...ZONE_TEMP_RQ, payload: '0007A0'});
        expect(line.split(' ')[7]).toBe('003');
    });

    test('uppercases the command and payload', () => {
        const line = encode({...ZONE_TEMP_RQ, cmd: '30c9', payload: 'ab'});
        expect(line).toBe('--- RQ --- 18:000730 01:123456 --:------ 30C9 001 AB');
    });

    test('round-trips through the parser', () => {
        const reparsed = parse(encode(ZONE_TEMP_RQ)).parsed;
        expect(reparsed.type).toBe('RQ');
        expect(reparsed.addr).toEqual(['18:000730', '01:123456', '--:------']);
        expect(reparsed.cmd).toBe('30C9');
        expect(reparsed.payload).toBe('00');
        expect(reparsed.len).toBe(1);
    });

    describe('validation', () => {
        test('rejects an unknown message type', () => {
            expect(() => encode({...ZONE_TEMP_RQ, type: 'XX'})).toThrow('unknown message type');
        });

        test('rejects the wrong number of addresses', () => {
            expect(() => encode({...ZONE_TEMP_RQ, addr: ['18:000730', '01:123456']}))
                .toThrow('expected exactly 3 addresses');
        });

        test('rejects a malformed address', () => {
            expect(() => encode({...ZONE_TEMP_RQ, addr: ['18:730', 'nonsense', '--:------']}))
                .toThrow('address incorrect format');
        });

        test('rejects a malformed command', () => {
            expect(() => encode({...ZONE_TEMP_RQ, cmd: '30C'})).toThrow('unrecognised command format');
        });

        test('rejects an odd-length payload', () => {
            expect(() => encode({...ZONE_TEMP_RQ, payload: '000'})).toThrow('badly formatted payload');
        });
    });
});

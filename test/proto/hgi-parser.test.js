/* eslint-disable indent */
/* eslint-disable function-paren-newline */
import {expect, describe, test} from 'vitest';
import parse from '../../src/proto/hgi-parser';

describe('HGI parser', () => {
    function ensureFail(input, message) {
        try {
            parse(input);
            expect.unreachable('Parsing should fail');
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
            expect(e.message).toContain(message);
        }
    }

    function testFailure(name, input, message) {
        test(name, () => {
            ensureFail(input, message);
        });
    }

    function bad(field, value) {
        // Take a good message and mutate one of its fields
        const message = ['080', 'I', '---', '01:234567', '--:------', '01:234567', '12B0', '003', '040000'];
        message[field - 1] = value;
        return message.join(' ');
    }

    testFailure('radio failure', '---  I --- 04:1\t*ERR_MANCHESTER_ENC*', 'malformed');
    testFailure('too few fields', '---  I ---', 'incorrect number');
    testFailure('too many fields', '1 2 3 4 5 6 7 8 9 10', 'incorrect number');

    testFailure('rssi non-numeric', bad(1, 'rssi'), 'rssi incorrect format');
    testFailure('unknown message type', bad(2, 'UNK'), 'unknown message type');
    testFailure('address 0 incorrect format', bad(4, 'X'), 'address 0 incorrect format');
    testFailure('address 1 incorrect format', bad(5, 'X'), 'address 1 incorrect format');
    testFailure('address 2 incorrect format', bad(6, 'X'), 'address 2 incorrect format');
    testFailure('unrecognised command format', bad(7, 'XXXX'), 'unrecognised command format');

    testFailure('length too short', bad(8, '12'), 'badly formatted length');
    testFailure('length too long', bad(8, '1234'), 'badly formatted length');

    testFailure('payload not hex encoded', bad(9, 'GHI'), 'badly formatted payload');

    testFailure('payload doesn\'t match length', '---  I --- --:------ --:------ --:------ 1111 003 04000',
                    'payload length does not match declared length');
    testFailure('payload doesn\'t match length', '---  I --- --:------ --:------ --:------ 1111 003 0400000',
                    'payload length does not match declared length');

    test('upper case', () => {
        const message = '--- rp --- 00:000000 00:000000 00:000000 5a5a 003 0a0b0c';
        const parsed = parse(message);

        expect(parsed.original).toEqual(message);
        expect(parsed.parsed.type).toEqual('RP');
        expect(parsed.parsed.cmd).toEqual('5A5A');
        expect(parsed.parsed.payload).toEqual('0A0B0C');
    });
});

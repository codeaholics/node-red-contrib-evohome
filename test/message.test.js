import {expect, describe, test} from 'vitest';
import Message from '../src/message';
import {
    makeConfig, makeMessage, randomControllerAddr, randomZoneAddr
} from './helpers';

const CONTROLLER = randomControllerAddr();
const OTHER_CONTROLLER = randomControllerAddr();
const ZONE = randomZoneAddr();
const config = makeConfig(CONTROLLER);

function msg(payload, {
    type = 'I', addr0 = '--:------', addr1 = '--:------', addr2 = '--:------'
} = {}) {
    return makeMessage({
        type, cmd: '30C9', payload, addr0, addr1, addr2
    }, config);
}

describe('type predicates', () => {
    test('isInformation()', () => {
        expect(msg('00', {type: 'I'}).isInformation()).toBe(true);
        expect(msg('00', {type: 'RQ'}).isInformation()).toBe(false);
    });

    test('isRequest()', () => {
        expect(msg('00', {type: 'RQ'}).isRequest()).toBe(true);
        expect(msg('00', {type: 'I'}).isRequest()).toBe(false);
    });

    test('isReply()', () => {
        expect(msg('00', {type: 'RP'}).isReply()).toBe(true);
        expect(msg('00', {type: 'I'}).isReply()).toBe(false);
    });

    test('isWrite()', () => {
        expect(msg('00', {type: 'W'}).isWrite()).toBe(true);
        expect(msg('00', {type: 'I'}).isWrite()).toBe(false);
    });
});

describe('length', () => {
    test('reflects payload byte count', () => {
        expect(msg('01020304').length).toBe(4);
        expect(msg('AB').length).toBe(1);
    });
});

describe('isEOF()', () => {
    test('false at start', () => {
        expect(msg('0102').isEOF()).toBe(false);
    });

    test('true after consuming all bytes', () => {
        const m = msg('01');
        m.getUInt8();
        expect(m.isEOF()).toBe(true);
    });

    test('true for empty payload', () => {
        // zero-length payload not valid HGI, but Message itself allows it
        const m = new Message({
            type: 'I', addr: ['--:------', '--:------', '--:------'], cmd: '30C9', len: 0, payload: ''
        }, config);
        expect(m.isEOF()).toBe(true);
    });
});

describe('skip()', () => {
    test('advances cursor', () => {
        const m = msg('010203');
        m.skip(2);
        expect(m.getUInt8()).toBe(0x03);
    });
});

describe('getUInt8()', () => {
    test('reads byte and advances cursor', () => {
        const m = msg('1A2B');
        expect(m.getUInt8()).toBe(0x1A);
        expect(m.getUInt8()).toBe(0x2B);
        expect(m.isEOF()).toBe(true);
    });

    test('throws at EOF', () => {
        const m = msg('FF');
        m.getUInt8();
        expect(() => m.getUInt8()).toThrow('Attempt to read beyond end of message.');
    });
});

describe('getUInt16()', () => {
    test('reads big-endian uint16 and advances cursor', () => {
        const m = msg('0834');
        expect(m.getUInt16()).toBe(0x0834);
        expect(m.isEOF()).toBe(true);
    });

    test('reads multiple uint16s in sequence', () => {
        const m = msg('08340096');
        expect(m.getUInt16()).toBe(0x0834);
        expect(m.getUInt16()).toBe(0x0096);
    });

    test('throws at EOF', () => {
        const m = msg('0102');
        m.getUInt16();
        expect(() => m.getUInt16()).toThrow('Attempt to read beyond end of message.');
    });

    test('throws when only 1 byte remains', () => {
        const m = msg('010203');
        m.getUInt8();
        // 2 bytes remain — OK
        m.skip(1);
        // 1 byte remains — must throw our error, not a raw RangeError from Buffer
        expect(() => m.getUInt16()).toThrow('Attempt to read beyond end of message.');
    });
});

describe('incorrectSite()', () => {
    test('false when no address is a controller', () => {
        const m = msg('00', {addr0: ZONE, addr1: '--:------', addr2: '--:------'});
        expect(m.incorrectSite()).toBe(false);
    });

    test('false when the only controller is the site controller', () => {
        const m = msg('00', {addr0: CONTROLLER, addr2: CONTROLLER});
        expect(m.incorrectSite()).toBe(false);
    });

    test('true when a controller address is not the site controller', () => {
        const m = msg('00', {addr0: OTHER_CONTROLLER, addr2: CONTROLLER});
        expect(m.incorrectSite()).toBe(true);
    });

    test('true when all controller addresses are foreign', () => {
        const m = msg('00', {addr2: OTHER_CONTROLLER});
        expect(m.incorrectSite()).toBe(true);
    });
});

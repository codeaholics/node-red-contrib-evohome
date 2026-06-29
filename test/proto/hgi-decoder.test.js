import {expect, describe, test} from 'vitest';
import decode from '../../src/proto/hgi-decoder';
import {makeConfig, randomControllerAddr} from '../helpers';

const CONTROLLER = randomControllerAddr();
const OTHER_CONTROLLER = randomControllerAddr();
const config = makeConfig(CONTROLLER, {zones: {1: 'Living Room', 2: 'Bedroom'}});

// Builds a parsed-level message as hgi-parser would produce it.
function parsed(cmd, payload, {
    type = 'I', addr0 = CONTROLLER, addr1 = '--:------', addr2 = CONTROLLER
} = {}) {
    return {
        type, addr: [addr0, addr1, addr2], cmd, len: payload.length / 2, payload
    };
}

const NOW = 1_000_000;

describe('hgi-decoder', () => {
    describe('required options', () => {
        test('throws when no options are given', () => {
            expect(() => decode(parsed('30C9', '000834'), config)).toThrow('cache must be provided');
        });

        test('throws when the cache is missing', () => {
            expect(() => decode(parsed('30C9', '000834'), config, {now: NOW}))
                .toThrow('cache must be provided');
        });

        test('throws when now is missing', () => {
            expect(() => decode(parsed('30C9', '000834'), config, {cache: {}}))
                .toThrow('now must be provided');
        });
    });

    describe('dispatch', () => {
        test('unknown command returns a single UNKNOWN', () => {
            expect(decode(parsed('FFFF', '00'), config, {cache: {}, now: NOW}))
                .toEqual([{type: 'UNKNOWN'}]);
        });

        test('drops a message from another site (incorrectSite)', () => {
            const p = parsed('30C9', '000834', {addr0: OTHER_CONTROLLER, addr2: OTHER_CONTROLLER});
            expect(decode(p, config, {cache: {}, now: NOW})).toEqual([]);
        });

        test('returns one decoded payload per result (multi-zone controller broadcast)', () => {
            const results = decode(parsed('30C9', '00083401096C'), config, {cache: {}, now: NOW});
            expect(results).toHaveLength(2);
            expect(results[0].type).toBe('ZONE_TEMP');
            expect(results[0].temperature).toBe(21.00);
            expect(results[1].temperature).toBe(24.12);
        });

        test('filters out null results (e.g. a request the decoder ignores)', () => {
            const p = parsed('2309', '00', {type: 'RQ'});
            expect(decode(p, config, {cache: {}, now: NOW})).toEqual([]);
        });

        test('propagates a decoder error (malformed payload)', () => {
            // 2309 payload of 2 bytes is too short for the temperature decoder
            expect(() => decode(parsed('2309', '0000'), config, {cache: {}, now: NOW}))
                .toThrow('payload too short');
        });
    });

    describe('deduplication', () => {
        test('a non-deduping decoder always emits and never touches the cache', () => {
            const cache = {};
            decode(parsed('30C9', '000834'), config, {cache, now: NOW});
            const again = decode(parsed('30C9', '000834'), config, {cache, now: NOW});
            expect(again).toHaveLength(1);            // zone-temp does not dedup
            expect(Object.keys(cache)).toHaveLength(0);
        });

        test('first sighting emits and populates the cache', () => {
            const cache = {};
            const results = decode(parsed('2309', '000834'), config, {cache, now: NOW});
            expect(results).toHaveLength(1);
            expect(Object.keys(cache)).toHaveLength(1);
        });

        test('an identical repeat within the TTL is suppressed', () => {
            const cache = {};
            decode(parsed('2309', '000834'), config, {cache, now: NOW});
            const repeat = decode(parsed('2309', '000834'), config, {cache, now: NOW + 1000});
            expect(repeat).toEqual([]);
        });

        test('a changed value emits even within the TTL', () => {
            const cache = {};
            decode(parsed('2309', '000834'), config, {cache, now: NOW});       // 21.00
            const changed = decode(parsed('2309', '000898'), config, {cache, now: NOW + 1000}); // 22.00
            expect(changed).toHaveLength(1);
            expect(changed[0].setpoint).toBe(22.00);
        });

        test('an identical repeat after the TTL emits again (heartbeat)', () => {
            const cache = {};
            decode(parsed('2309', '000834'), config, {cache, now: NOW});       // TTL 3600s
            const later = decode(parsed('2309', '000834'), config, {cache, now: NOW + 3_600_001});
            expect(later).toHaveLength(1);
        });

        test('the same cache threaded across calls is what enables suppression', () => {
            // A fresh cache per call (the trap) would never suppress.
            const freshEachTime = () => decode(parsed('2309', '000834'), config, {cache: {}, now: NOW});
            expect(freshEachTime()).toHaveLength(1);
            expect(freshEachTime()).toHaveLength(1);  // not suppressed — different caches
        });
    });
});

import {expect, describe, test} from 'vitest';
import {
    parseDuration, resolveWindow, flattenInfluxResult, rowToParsed,
    toLineProtocol, measurementRewriter, seriesKey, createCollisionTracker,
    dropMeasurementStatement, batch
} from '../../scripts/backfill/lib';

describe('parseDuration', () => {
    test('parses each unit', () => {
        expect(parseDuration('90s')).toBe(90 * 1000);
        expect(parseDuration('30m')).toBe(30 * 60 * 1000);
        expect(parseDuration('24h')).toBe(24 * 60 * 60 * 1000);
        expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
        expect(parseDuration('2w')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    });

    test('rejects nonsense', () => {
        expect(() => parseDuration('7')).toThrow('invalid duration');
        expect(() => parseDuration('7y')).toThrow('invalid duration');
    });
});

describe('resolveWindow', () => {
    const FROM = '2020-01-01T00:00:00Z';
    const fromMs = Date.parse(FROM);

    test('explicit to', () => {
        const {fromMs: f, toMs} = resolveWindow({from: FROM, to: '2020-01-02T00:00:00Z'});
        expect(f).toBe(fromMs);
        expect(toMs).toBe(Date.parse('2020-01-02T00:00:00Z'));
    });

    test('from + duration', () => {
        const {toMs} = resolveWindow({from: FROM, duration: '1d'});
        expect(toMs).toBe(fromMs + 24 * 60 * 60 * 1000);
    });

    test('defaults to now when neither to nor duration given', () => {
        const now = fromMs + 1000;
        expect(resolveWindow({from: FROM, now}).toMs).toBe(now);
    });

    test('requires from', () => {
        expect(() => resolveWindow({})).toThrow('--from is required');
    });

    test('rejects an end at or before from', () => {
        expect(() => resolveWindow({from: FROM, to: FROM})).toThrow('must be after');
    });

    test('rejects an unparseable date', () => {
        expect(() => resolveWindow({from: 'not-a-date'})).toThrow('invalid --from');
    });
});

describe('flattenInfluxResult', () => {
    test('maps columns onto each value tuple', () => {
        const obj = {
            results: [{
                series: [{
                    columns: ['time', 'cmd', 'payload'],
                    values: [[100, '30C9', '000834'], [200, '2309', '000898']]
                }]
            }]
        };
        const rows = [...flattenInfluxResult(obj)];
        expect(rows).toEqual([
            {time: 100, cmd: '30C9', payload: '000834'},
            {time: 200, cmd: '2309', payload: '000898'}
        ]);
    });

    test('tolerates an empty result', () => {
        expect([...flattenInfluxResult({results: [{}]})]).toEqual([]);
    });

    test('throws on a query error', () => {
        expect(() => [...flattenInfluxResult({results: [{error: 'boom'}]})]).toThrow('boom');
    });
});

describe('rowToParsed', () => {
    test('reshapes a row into a parsed message', () => {
        const parsed = rowToParsed({
            time: 1,
            type: 'I',
            cmd: '30C9',
            len: 3,
            payload: '000834',
            addr0: '01:080777',
            addr1: '--:------',
            addr2: '01:080777'
        });
        expect(parsed).toEqual({
            type: 'I',
            cmd: '30C9',
            len: 3,
            payload: '000834',
            addr: ['01:080777', '--:------', '01:080777']
        });
    });

    test('coalesces missing addresses to the unused sentinel', () => {
        expect(rowToParsed({type: 'I', cmd: '30C9'}).addr).toEqual(['--:------', '--:------', '--:------']);
    });
});

describe('toLineProtocol', () => {
    test('serialises measurement, tags and float field with timestamp', () => {
        const line = toLineProtocol(
            {measurement: 'ZoneTemp', tags: {device: '01:080777'}, values: {temperature: 21}},
            1700000000000
        );
        expect(line).toBe('ZoneTemp,device=01:080777 temperature=21 1700000000000');
    });

    test('quotes string fields and escapes spaces in tags', () => {
        const line = toLineProtocol(
            {measurement: 'DHWState', tags: {deviceName: 'Hot Water'}, values: {state: 'on', mode: 'Permanent'}},
            5
        );
        expect(line).toBe('DHWState,deviceName=Hot\\ Water state="on",mode="Permanent" 5');
    });

    test('omits null/undefined tags and fields', () => {
        const line = toLineProtocol(
            {measurement: 'M', tags: {a: 1, b: null}, values: {x: 2, y: undefined}},
            9
        );
        expect(line).toBe('M,a=1 x=2 9');
    });

    test('throws when there are no fields to write', () => {
        expect(() => toLineProtocol({measurement: 'M', tags: {a: 1}, values: {}}, 1))
            .toThrow('no fields');
    });
});

describe('measurementRewriter', () => {
    const point = {measurement: 'DHWState', tags: {}, values: {}};

    test('identity by default', () => {
        expect(measurementRewriter()(point).measurement).toBe('DHWState');
    });

    test('suffix appends', () => {
        expect(measurementRewriter({suffix: '_test'})(point).measurement).toBe('DHWState_test');
    });

    test('name forces an exact measurement', () => {
        expect(measurementRewriter({name: 'scratch'})(point).measurement).toBe('scratch');
    });

    test('does not mutate the input point', () => {
        measurementRewriter({suffix: '_x'})(point);
        expect(point.measurement).toBe('DHWState');
    });
});

describe('seriesKey', () => {
    test('is measurement + tags, order-independent', () => {
        const a = seriesKey({measurement: 'M', tags: {b: '2', a: '1'}});
        const b = seriesKey({measurement: 'M', tags: {a: '1', b: '2'}});
        expect(a).toBe(b);
        expect(a).toBe('M,a=1,b=2');
    });

    test('drops null/undefined tags and stringifies values', () => {
        expect(seriesKey({measurement: 'M', tags: {z: 3, gone: null}})).toBe('M,z=3');
    });

    test('measurement only when there are no tags', () => {
        expect(seriesKey({measurement: 'M', tags: {}})).toBe('M');
    });
});

describe('createCollisionTracker', () => {
    const point = {measurement: 'DHWSetpoint', tags: {device: '01:080777'}};
    const other = {measurement: 'DHWSetpoint', tags: {device: '01:149876'}};

    test('no collision for distinct timestamps in a series', () => {
        const t = createCollisionTracker();
        t.record(point, 100);
        t.record(point, 200);
        expect(t.collisions).toBe(0);
        expect(t.series).toBe(1);
    });

    test('counts a collision for the same series and timestamp', () => {
        const t = createCollisionTracker();
        t.record(point, 100);
        t.record(point, 100);
        expect(t.collisions).toBe(1);
    });

    test('three points at one timestamp are two collisions (one row stored)', () => {
        const t = createCollisionTracker();
        t.record(point, 100);
        t.record(point, 100);
        t.record(point, 100);
        expect(t.collisions).toBe(2);
    });

    test('same timestamp in different series does not collide', () => {
        const t = createCollisionTracker();
        t.record(point, 100);
        t.record(other, 100);
        expect(t.collisions).toBe(0);
        expect(t.series).toBe(2);
    });
});

describe('dropMeasurementStatement', () => {
    test('double-quotes the measurement name', () => {
        expect(dropMeasurementStatement('DHWSetpoint')).toBe('DROP MEASUREMENT "DHWSetpoint"');
    });

    test('escapes an embedded double-quote', () => {
        expect(dropMeasurementStatement('a"b')).toBe('DROP MEASUREMENT "a\\"b"');
    });
});

describe('batch', () => {
    async function* gen(items) {
        for (const i of items) yield i; // eslint-disable-line no-restricted-syntax
    }
    async function collect(asyncIter) {
        const out = [];
        for await (const x of asyncIter) out.push(x); // eslint-disable-line no-restricted-syntax
        return out;
    }

    test('groups into full batches', async () => {
        expect(await collect(batch(gen([1, 2, 3, 4]), 2))).toEqual([[1, 2], [3, 4]]);
    });

    test('flushes a trailing partial batch', async () => {
        expect(await collect(batch(gen([1, 2, 3, 4, 5]), 2))).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('emits nothing for an empty source', async () => {
        expect(await collect(batch(gen([]), 2))).toEqual([]);
    });
});

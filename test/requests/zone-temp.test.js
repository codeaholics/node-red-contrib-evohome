import {expect, describe, test} from 'vitest';
import requestZoneTemp from '../../src/requests/zone-temp';

describe('requestZoneTemp', () => {
    test('builds an RQ for the given controller and zone', () => {
        const req = requestZoneTemp('01:123456', 1, '18:000730');
        expect(req.type).toBe('RQ');
        expect(req.cmd).toBe('30C9');
        expect(req.addr).toEqual(['18:000730', '01:123456', '--:------']);
    });

    test('converts the 1-based zone to a 0-based payload byte', () => {
        expect(requestZoneTemp('01:123456', 1, '18:000730').payload).toBe('00');
        expect(requestZoneTemp('01:123456', 12, '18:000730').payload).toBe('0B');
    });
});

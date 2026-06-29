import {expect, describe, test} from 'vitest';
import requestSetpointOverride from '../../src/requests/setpoint-override';

describe('requestSetpointOverride', () => {
    test('builds an RQ for the given controller and zone', () => {
        const req = requestSetpointOverride('01:123456', 1, '18:000730');
        expect(req.type).toBe('RQ');
        expect(req.cmd).toBe('2349');
        expect(req.addr).toEqual(['18:000730', '01:123456', '--:------']);
    });

    test('converts the 1-based zone to a 0-based payload byte', () => {
        expect(requestSetpointOverride('01:123456', 1, '18:000730').payload).toBe('00');
        expect(requestSetpointOverride('01:123456', 12, '18:000730').payload).toBe('0B');
    });
});

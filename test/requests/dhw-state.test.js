import {expect, describe, test} from 'vitest';
import requestDhwState from '../../src/requests/dhw-state';

describe('requestDhwState', () => {
    test('builds a per-controller RQ with the domain selector byte', () => {
        const req = requestDhwState('01:123456', '18:000730');
        expect(req.type).toBe('RQ');
        expect(req.cmd).toBe('1F41');
        expect(req.addr).toEqual(['18:000730', '01:123456', '--:------']);
        expect(req.payload).toBe('00');
    });
});

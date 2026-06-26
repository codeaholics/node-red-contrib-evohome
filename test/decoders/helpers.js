import parse from '../../src/proto/hgi-parser';
import Message from '../../src/message';
import Config from '../../src/config';

function randomAddr(type) {
    const id = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    return `${type}:${id}`;
}

export const randomControllerAddr = () => randomAddr('01');
export const randomZoneAddr = () => randomAddr('04');
export const randomSensorAddr = () => randomAddr('07');
export const randomOpenThermAddr = () => randomAddr('10');
export const randomRelayAddr = () => randomAddr('13');

export function makeConfig(controller) {
    return new Config({controller, zones: {}, devices: {}});
}

export function makeMessage(
    {
        type, cmd, payload,
        addr0 = '--:------', addr1 = '--:------', addr2 = '--:------',
    },
    config
) {
    const len = String(payload.length / 2).padStart(3, '0');
    const str = `--- ${type} --- ${addr0} ${addr1} ${addr2} ${cmd} ${len} ${payload}`;
    const {parsed} = parse(str);
    return new Message(parsed, config);
}

export default function(m) {
    if (!m.addr[0].isZone() || !m.addr[2].isSiteController() || !m.isInformation()) { return null; }
    if (m.length !== 3) { throw new Error('ZONE_WINDOW payload length incorrect'); }

    m.skip(1);
    const window = m.getUInt8() / 2;

    return {
        decoded: {
            type: 'ZONE_WINDOW',
            device: m.addr[0].describe(),
            windowOpen: window
        }
    };
}

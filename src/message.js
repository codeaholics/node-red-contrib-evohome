const Address = require('./address');

class Message {
    #p = 0;

    #bytes;

    #parsed;

    #addrs;

    constructor(parsed, config) {
        this.#parsed = parsed;
        this.#bytes = Buffer.from(parsed.payload, 'hex');
        this.#addrs = Object.freeze([
            new Address(parsed.addr[0], config),
            new Address(parsed.addr[1], config),
            new Address(parsed.addr[2], config),
        ]);
    }

    get length() { return this.#parsed.len; }

    get addr() { return this.#addrs; }

    isInformation() { return this.#parsed.type === 'I'; }

    isRequest() { return this.#parsed.type === 'RQ'; }

    isReply() { return this.#parsed.type === 'RP'; }

    isWrite() { return this.#parsed.type === 'W'; }

    incorrectSite() {
        return this.#addrs.reduce((acc, it) => acc || (it.isController() && !it.isSiteController()), false);
    }

    isEOF() { return this.#p >= this.#parsed.len; }

    skip(c) { this.#p += c; }

    getUInt8() {
        if (this.isEOF()) throw new Error('Attempt to read beyond end of message.');
        return this.#bytes.readUInt8(this.#p++); // eslint-disable-line no-plusplus
    }

    getUInt16() {
        if (this.#p + 2 > this.#parsed.len) throw new Error('Attempt to read beyond end of message.');
        const result = this.#bytes.readUInt16BE(this.#p);
        this.#p += 2;
        return result;
    }

    // Reads the Evohome 6-byte datetime: mins, hrs, day, month, year (BE16).
    // Returns an ISO-like local string (YYYY-MM-DDTHH:MM:00) or null when the
    // year is 0xFFFF (no date set).
    getDateTime() {
        const mins = this.getUInt8();
        const hrs = this.getUInt8();
        const day = this.getUInt8();
        const month = this.getUInt8();
        const year = this.getUInt16();
        if (year === 0xFFFF) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${year}-${pad(month)}-${pad(day)}T${pad(hrs)}:${pad(mins)}:00`;
    }
}

module.exports = Message;

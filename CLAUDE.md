# node-red-contrib-evohome

Node-RED nodes for integrating with the Honeywell Evohome heating system via a HGI80 USB/serial gateway.

## What this is

The HGI80 gateway exposes a serial interface carrying a proprietary RF protocol. To feed it into this package you need either a TCP bridge (e.g. ser2net) consumed by the `evohome-tcp-connection` node, or a standard Node-RED serial node if the HGI80 is directly attached to the server. This package parses those messages, decodes them into structured data, and makes them available in Node-RED flows. The primary downstream use is writing to InfluxDB for time-series monitoring.

## Architecture

Inbound (passive) messages flow through a pipeline of Node-RED nodes:

```
TCP Gateway (HGI80)
    → evohome-tcp-connection  (config node: manages TCP socket, auto-reconnects)
    → evohome-in              (input node: adds timestamp, trims payload)
    → evohome-hgi-parser      (parses raw HGI80 wire format into structured object)
    → evohome-decoder         (dispatches to command-specific decoders, deduplicates)
    → evohome-influxdb-formatter  (converts to InfluxDB line protocol)
```

Outbound (active) requests flow the other way — this is how the package actively polls the controller rather than only listening:

```
evohome-active   (builds requests on a timer; paced send queue; unused "spy" input for future reply-driven polling)
    → evohome-encoder         (serialises a structured message into an HGI80 wire line)
    → evohome-out             (writes the line to the gateway via evohome-tcp-connection)
    → TCP Gateway (HGI80)
```

Replies come back through the inbound pipeline above; there is no request/response correlation — a reply is just another decoded message.

Config nodes: `evohome-tcp-connection` (TCP connection) and `evohome-site-configuration` (JSON site config mapping device addresses to names/zones).

## Commands and tests

```bash
npm test        # run vitest test suite
npm run lint    # eslint (airbnb-base, 4-space indent, 120 char line)
```

## Key directories

```
src/nodes/               # 10 Node-RED node definitions
src/decoders/            # Inbound: one decoder per command code (parsed → decoded)
src/decoders/utils/      # Shared helpers (temperature-decoder.js)
src/requests/            # Outbound: one builder per command code (intent → parsed)
src/requests/utils/      # Shared request-builder factories (zone-selector-request.js)
src/influxdb-formatters/ # One file per message type for InfluxDB output
src/proto/               # HGI80 wire format parser (hgi-parser) and encoder (hgi-encoder)
src/address.js           # Device address type-checking and name lookup
src/config.js            # Site config loader (controller/zone/relay/device maps)
src/message.js           # Message wrapper with binary field accessors
test/proto/              # Parser and encoder tests (good coverage)
test/decoders/           # Decoder tests (mostly stubs — expand these)
test/requests/           # Request builder tests
```

## HGI80 message format

A received line has 9 space-separated fields: `RSSI type flag addr0 addr1 addr2 CMD len payload`

- RSSI: signal strength, prepended by the radio **on receipt only**
- Type: `I` (info), `W` (write), `RQ` (request), `RP` (reply)
- flag: a field whose meaning is not yet understood (`---` when absent)
- Addresses: `NN:NNNNNN` (device-type prefix : serial), or `--:------` if unused
- CMD: 4-char hex command code
- Payload: hex string, length must match `len * 2`

Lines we **send** omit the RSSI (8 fields, starting at `type`); the radio adds it on receipt. `src/proto/hgi-encoder.js` produces this 8-field form, so it is deliberately not a perfect inverse of the parser.

## Decoder map

Each command code maps to a decoder in `src/decoders/`. Decoders return `{decoded, deduplication?}` or an array of results, or `null` to skip. See `TODO` for message codes, their frequency in the wild, and implementation status.

## Device addresses

Evohome addresses take the form `type:id` — a two-digit device class prefix and a six-digit serial number (e.g. `04:025902`). The type prefix is what drives logic: routing, decoding, filtering. The ID is incidental. See `src/address.js` for the full type mapping.

## Code conventions

- Airbnb ESLint base — run `npm run lint` before committing
- 4-space indent, 120-char max line
- Decoders are pure functions: take `(message, config)`, return decoded object or null
- Request builders (`src/requests/`) are pure functions returning a parsed-level message `{type, addr, cmd, payload}` for the encoder; they own outbound payload/addressing (e.g. zones are 1-based in config but 0-based on the wire)
- Deduplication: return `{decoded, deduplication: {key, ttl}}` — the decoder node caches by key and suppresses repeats within ttl seconds
- Temperature values: UInt16 / 100 → Celsius; skip `0x7FFF` (no reading)
- InfluxDB formatters: exclude `undefined`/`null` tag values

## Protocol references

- https://github.com/smar000/evohome-Listener — Python reference implementation
- `http://files.domoticaforum.eu/uploads/Evihome/WirelessProtocol.pdf` — protocol spec

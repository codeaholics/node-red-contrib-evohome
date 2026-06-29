# Evohome RF message formats

Reference for the message formats this package decodes (and intends to), drawn
from the Domoticz decoders in `domoticz-src/` and cross-checked against real
traffic captured from a live system (the `ParsedRadioMessages` InfluxDB
measurement). Where a fact is "observed" it came from that capture; where it's
"per Domoticz" it came from the reference implementation.

See also: [DOMOTICZ-ACTIVE-WORK.md](../DOMOTICZ-ACTIVE-WORK.md),
[ideas/vertical-slices.md](../ideas/vertical-slices.md).

## Wire line

A received line has 9 space-separated fields; a line we **send** omits the
leading RSSI (8 fields). See `src/proto/hgi-parser.js` / `hgi-encoder.js`.

```
RSSI  type  flag  addr0  addr1  addr2  CMD  len  payload
```

- **type** — `I` (info/broadcast), `RQ` (request), `RP` (reply), `W` (write)
- **flag** — purpose unknown; `---` when absent
- **addrN** — `TT:NNNNNN` (2-digit device-type prefix : serial) or `--:------`
- **CMD** — 4-char hex command code
- **payload** — hex, `len` bytes

## Address type prefixes

From `src/address.js`:

| Prefix | Device |
|---|---|
| `01` | controller |
| `04` | zone (TRV / radiator) |
| `07` | sensor |
| `10` | OpenTherm bridge |
| `13` | relay |
| `18` | gateway (HGI80) |
| `22` | DTS92 thermostat |
| `30` | remote |
| `34` | T87RF thermostat |

## Addressing by message type — the key rule

**`addr0` is always the source/reporter.** What sits there depends on message
type and who's talking:

| Type | addr0 | addr1 | addr2 | Meaning |
|---|---|---|---|---|
| `I` (controller broadcast) | controller | `--` | controller | Controller reports all zones; zone is a payload index |
| `I` (device broadcast) | the device (`04`/`22`/`34`) | `--` | itself (or controller) | A device reports its own reading |
| `RQ` | **gateway** | controller | `--` | We/Domoticz ask the controller |
| `RP` | **controller** | gateway | `--` | Controller answers |

Consequences for decoders and dedup keys:

- A **reading only legitimately arrives as `I` or `RP`.** On both, `addr0` is the
  source. On `RQ`, `addr0` is the gateway — never a reading. Decoders should
  therefore whitelist `I`/`RP` (or at least reject requests) before trusting
  `addr0`.
- A **controller multiplexes every zone onto its one address**, so a key for
  controller-sourced data needs the payload **zone index** as well as `addr0`.
  Device-sourced data (`04`/`22`/`34`) carries a globally-unique address, so
  `addr0` alone identifies it.
- Multi-controller is safe on `addr0`: each controller's broadcast carries its
  own address, so e.g. controller A zone 1 and controller B zone 1 never collide.

## Per-command formats

### 30C9 — ZONE_TEMP (temperature) — observed `I` + `RQ`/`RP`
Repeating 3-byte blocks: `zone(1) temp(2)`. Controller sends all zones in one
message; individual `04`/`22`/`34` devices broadcast their own (single block).
Temp = uint16 ÷ 100 °C; `0x7FFF` = no reading. **Broadcast and pollable.**

### 2309 — SETPOINT (target temperature) — observed `I` only
Same `zone(1) temp(2)` repeating layout as 30C9. The *current effective* target
(reflects schedule or override). **Broadcast only — never polled.** Controller
broadcasts all zones; `04`/`22` devices broadcast their own.

### 2349 — SETPOINT_OVERRIDE — observed `RQ`/`RP` only (poll-only)
```
zone(1) setpoint(2) mode(1) FFFFFF(3)  [until-datetime(6)]
```
7 bytes, or 13 with an until-time. `setpoint` = uint16 ÷ 100, `0x7FFF` = none.
`mode` per the override-mode table below. **Poll-only** — the override mode is
*only* obtainable by requesting it (the value also comes free via 2309).

### 1F41 — DHW_STATE — observed `I` (on change) + `RQ`/`RP`
```
domain(1) state(1) mode(1) FFFFFF(3)  [until-datetime(6)]
```
6 bytes, or 12 with an until-time. `state`: `00`=off, `01`=on, `FF`=not
installed. `mode` per the override-mode table. Observed `000100FFFFFF` = DHW on,
follow-schedule. **Broadcast on change** (every override change appears as a
type `I` from the controller) **and pollable** — the poll just fetches the
current baseline (e.g. after a restart). This is the DHW parallel to 2349: the
override metadata (mode + until) for the on/off state, *not* a temperature.
There is no DHW setpoint override.

### 10A0 — DHW_SETPOINT — observed `I` + `RQ`/`RP`
```
devno(1) setpoint(2) overrun(1) differential(2)   (6 bytes)
```
`setpoint` and `differential` = uint16 ÷ 100 °C. Observed `0017700001F4` =
target 60.00 °C, differential 5.00 °C (reheat at 55). The DHW target temperature
and reheat band — the DHW parallel to 2309/2349 (a temperature target). The
`RQ`/`RP` every ~4 h come from the **cylinder sensor** (`07:…`) polling the
controller, not from a gateway — so this needs no active poll from us. Domoticz
never decoded it. `overrun` purpose unconfirmed.

### 2E04 — CONTROLLER_MODE — observed `RQ`/`RP` (rare broadcast)
```
mode(1) until-datetime(6) flag(1)      (8 bytes)
```
`mode` per the controller-mode table. `flag`: `0`=permanent, `1`=temporary.
Observed RP `00FFFFFFFFFFFF00` = Auto, permanent. Changes rarely; the `RQ` is a
single `FF` byte.

### 3150 — HEAT_DEMAND (zone) — observed `I`, from `01`/`04`/`10`
`zone(1) demand(1)`. `demand` = byte ÷ 200 → 0–100 %. **Per-device sourced** —
each zone's demand comes from its own sensing device (TRV / controller / OT
bridge), so `addr0` is unique per zone. Broadcast only.

### 0008 — CONTROLLER_HEAT_DEMAND — observed `I`, from controller
`devno(1) demand(1)` where `devno` is a pseudo-zone: `FC`(252)=boiler,
`FA`(250)=DHW, `F9`(249)=central heating. Same `÷200` demand. Broadcast only.

### 1260 — DHW_TEMP — observed `RQ`/`RP`
Repeating `devno(1) temp(2)`; `devno` always `00` for DHW. Temp = uint16 ÷ 100;
`0x7FFF` = not installed. Polled (the controller can't be uniquely tied to the
DHW sensor, hence the poll workaround).

### 1060 — BATTERY_INFO — observed `I`
`zone(1, ignore) level(1) ok(1)`. `ok==0` → flat; `level==255` → full; else
`level ÷ 2` %. Per-device (`addr0` = the battery-powered device).

### 12B0 — ZONE_WINDOW — observed `I`
Open-window / ventilation state per zone. Broadcast.

## Shared encodings

**Temperature** (30C9, 2309, 2349, 1260, …): big-endian uint16 ÷ 100 °C;
`0x7FFF` = no reading / not installed.

**Override mode** (2349 *and* 1F41 — same table, `m_evoToDczOverrideMode`):

| byte | meaning |
|---|---|
| `0` | FollowSchedule |
| `2` | Permanent |
| `4` | Temporary (until-time present) |

**Datetime** (the 6-byte until-time in the temporary forms of 2349 and 1F41, and
2E04 — Domoticz `CEvohomeDateTime`):
```
mins(1) hrs(1) day(1) month(1) year(BE16)
```
`year == 0xFFFF` means no date. Example `00 17 1C 06 07EA` → 2026-06-28 23:00
(the next schedule switchpoint). Decoded by `Message.getDateTime()`. Assumed to
be controller local time.

**Controller mode** (2E04, `m_evoToDczControllerMode`):

| byte | meaning |
|---|---|
| `0` | Auto / Normal |
| `1` | HeatingOff |
| `2` | AutoWithEco |
| `3` | Away |
| `4` | DayOff |
| `7` | Custom |

(`5`, `6` are invalid/hidden.) Plus a trailing `flag`: `0`=permanent,
`1`=temporary.

## Broadcast vs poll-only (observed)

This matters because **poll-only data disappears if nobody polls** — so the
active node's polls are load-bearing for these, not redundant.

- **Broadcast (free, passive):** 2309 setpoint, 30C9 zone-temp (also pollable),
  3150 heat-demand, 0008 controller-heat-demand, 12B0 window, 1060 battery,
  1F09 sync, 10A0 DHW-setpoint (also polled by the cylinder sensor).
- **Broadcast on change + pollable:** 1F41 DHW-state, 2E04 controller-mode (every
  change appears as `I`; the poll fetches the baseline after a restart).
- **Poll-only (RQ/RP, no `I`):** 2349 setpoint-override, 1260 DHW-temp, and the
  OpenTherm set (3220, 22D9, 3EF0).

## Observed system topology

The capture is from a **two-controller** site:

- Controllers: `01:080777` (A) and `01:149876` (B).
- Gateway / HGI80: `18:056026`. It polls **only controller A** (RQ `addr0=18 →
  addr1=01:080777`); controller B is seen only via its broadcasts.
- A single OpenTherm bridge `10:070915` talks to **both** controllers.

Implication: B's poll-only data (override, DHW state) has never been requested,
so whether B answers an RQ from a gateway is unverified — the open question for
full multi-controller coverage.

## Command catalogue (seen on this system)

Decoded today: `30C9`, `2309`, `2349`, `1260`, `1F41`, `10A0`, `3150`, `0008`,
`1060`, `12B0`, `3EF0` (actuator-state). Stubbed/undecoded but present: `0004`,
`000A`, `0418`, `10E0`, `1FC9`, `2E04`, `3B00`. Also seen and currently unhandled
(several OpenTherm / sync): `0001`, `0005`, `0009`, `000E`, `0016`, `0100`,
`042F`, `1030`, `10A0`, `1100`, `1F09`, `1FD4`, `22D9`, `3120`, `313F`, `3220`,
`3220`, `4611`, `4901`, `4907`.

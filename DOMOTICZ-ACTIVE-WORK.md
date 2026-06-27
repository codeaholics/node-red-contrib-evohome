# Domoticz Evohome — Active Radio Work

A complete inventory of everything Domoticz **transmits** over the radio for its
Evohome integration — i.e. every behaviour beyond passively listening for RF
messages. The goal is to understand what would need replicating to replace
Domoticz with the Node-RED nodes in this package.

Source references are to `domoticz-src/hardware/EvohomeRadio.cpp` (and
`EvohomeSerial.cpp` / `EvohomeTCP.cpp`) unless noted.

## How the active machinery is driven

- The worker thread (`Do_Work`, `EvohomeSerial.cpp:89` / `EvohomeTCP.cpp`) loops
  once per second. On each tick, if connected, it calls `Idle_Work()`
  (`EvohomeRadio.cpp:1578`).
- `Idle_Work` first calls `Send()`, which pops **one** message off
  `m_SendQueue` and writes it to the gateway (`EvohomeRadio.cpp:1553`). So
  everything queued by the methods below is drained one packet per second, and
  only when not mid-receive.
- On connect, `OnConnect()` (`EvohomeRadio.cpp:1572`) fires
  `RequestCurrentState()` — but only if a controller ID is already known.

Every active transmission ultimately comes from one of three triggers:
**startup/connect**, the **1-second `Idle_Work` timer**, or a **response to a
received message**.

---

## 1. Request methods (RQ packets sent to the controller)

Pure outbound requests (`pktreq`) addressed to the controller, each pushing one
message onto the send queue (`EvohomeRadio.cpp:221-312`):

| Method | Command | What it asks for |
|---|---|---|
| `RequestZoneTemp(zone)` | `0x30C9` | Zone temperature |
| `RequestZoneName(zone)` | `0x0004` | Zone name |
| `RequestZoneInfo(zone)` | `0x000A` | Zone min/max/flags |
| `RequestSetPointOverride(zone)` | `0x2349` | Zone setpoint + override mode |
| `RequestDHWState()` | `0x1F41` | Hot water state |
| `RequestDHWTemp()` | `0x1260` | Hot water temperature |
| `RequestControllerMode()` | `0x2E04` | Controller mode (auto/away/etc.) |
| `RequestSysInfo()` | `0x10E0` | System/firmware info |
| `RequestDeviceInfo(addr)` | `0x0418` | Device enumeration entry at index `addr` |

**Composite requests:**

- `RequestZoneStartupInfo(zone)` (`:269`) → ZoneTemp + SetPointOverride +
  ZoneInfo + ZoneName for one zone.
- `RequestCurrentState()` (`:278`) → SysInfo + ControllerMode + DHWTemp +
  DHWState + ZoneStartupInfo(0) + DeviceInfo(0). This is the connect-time
  bootstrap.
- `RequestZoneState()` (`:289`) → SetPointOverride for **every** zone + DHWState
  + `SendExternalSensor()` + `SendZoneSensor()`. This is the recurring refresh
  (see triggers below).
- `RequestZoneNames()` (`:301`) → ZoneName for every zone.

---

## 2. Startup / discovery sequence (`nStartup` / `nStarts` / `startup`)

In `Idle_Work` (`EvohomeRadio.cpp:1581-1642`), a counter `nStartup` increments
each second. **Every 300 seconds** it fires a block, then resets to 0 — so this
is a repeating 5-minute cycle, with behaviour depending on whether initial setup
(`startup`) has completed:

- **While `startup == true`** (controller not yet fully established): calls
  `InitControllerName()`, `InitZoneNames()`, `RequestZoneNames()`. If the
  controller ID is still the dummy `0xFFFFFF`, it counts how many controllers it
  overheard:
  - Multiple controllers → logs an error and **`StopHardware()`** (forces the
    user to set the ID manually).
  - Exactly one → adopts it via `SetControllerID()`, clears `startup`, and calls
    `RequestCurrentState()`.
- **Once `startup == false`** (normal running): every 300 s re-requests **each
  individual zone temperature** (`RequestZoneTemp(i)` for all zones — a
  workaround because the controller omits multi-room zones from broadcasts) plus
  `RequestDHWTemp()`.
- **`nStarts` counter**: counts these 300 s cycles. After 20 of them (~1 hour),
  fires `RequestZoneNames()` once more to pick up devices that have since
  announced themselves, then stops (`nStarts` frozen at 21).
- Also runs DB housekeeping on early cycles to detect/activate "AllSensors" mode
  and delete a dummy `FFFFFF` sensor row.

A separate chained discovery walks zone-name and device-info enumeration (§4).

---

## 3. Relay emulation — Domoticz pretending to be a relay/actuator

Requires the HGI80 gateway ID (`GetGatewayID() != 0`). When you create "custom
relays" (device unit 64–95), Domoticz actively drives the boiler relay protocol.

- **`SetRelayHeatDemand` / `SendRelayHeatDemand`** (`:315-333`): broadcasts a
  controller-heat-demand info packet (`0x0008`) with devno+demand. Triggered by
  `WriteToHardware` when you control a relay device.
- **`CheckRelayHeatDemand`** (`:336`, called from `Idle_Work` `:1646`): for every
  tracked relay, if **>1202 s** (~20 min) since last refresh, re-broadcasts its
  current heat demand. Keeps the relay "alive" to the boiler.
- **`SendRelayKeepAlive`** (`:349`, called from `Idle_Work` `:1647`): every
  **604 s** (~10 min) broadcasts an actuator-check packet (`0x3B00`, `FC C8`) to
  synchronise relay cycle timing.

On hardware start (`StartHardware:156-162`) it pre-loads `m_RelayCheck` from the
DB so these refreshes resume after a restart.

---

## 4. Active responses triggered by *received* messages

The subtle ones — receiving a passive broadcast causes Domoticz to transmit:

- **Zone temp broadcast received** (`DecodeZoneTemp`, `:921-923`): on a controller
  `0x30C9` info packet, calls `RequestZoneState()` (poll all setpoints + DHW +
  send sensors). If a *new* zone was detected, also `RequestZoneNames()`. This is
  effectively the main periodic poll — it piggybacks on the controller's regular
  temperature broadcasts.
- **Controller mode change received** (`DecodeControllerMode`, `:1104-1105`): if
  the mode actually changed, calls `RequestZoneState()`.
- **Zone name received during startup** (`DecodeZoneName`, `:1163-1164`): if
  `m_bStartup[0]` and more zones remain, calls
  `RequestZoneStartupInfo(nextZone)` — a self-chaining cascade that walks through
  all zones pulling temp/setpoint/info/name for each.
- **Device info received during startup** (`DecodeDeviceInfo`, `:1442-1443`): if
  `m_bStartup[1]`, calls `RequestDeviceInfo(addr+1)` — self-chaining walk through
  the controller's device table until an invalid entry ends it.
- **DHW heat-demand received** (`DecodeHeatDemand`, `:1348`): when the DHW zone
  valve (`0xFA`) reports demand, calls `RequestDHWState()` to refresh hot-water
  state.

(Note: `DecodeHeatDemand`/`DecodeActuatorState` also call `RXRelay`, but that's
an internal Domoticz device update, **not** a radio transmit.)

---

## 5. User-initiated writes (`WriteToHardware`, `:189`)

When you change something in the Domoticz UI, it transmits a write (`pktwrt`) to
the controller:

- **Controller mode** → `0x2E04` write.
- **Zone setpoint override** → `0x2349` write (temperature + mode + optional
  until-time).
- **DHW state** → `0x1F41` write.
- **Relay demand** → routed to `SetRelayHeatDemand` (§3, an info broadcast, not a
  controller write).

---

## 6. Binding (`Bind`, `:656`; triggered from web UI `RType_BindEvohome`, `:1658`)

User-initiated from hardware settings. Each mode loops, repeatedly transmitting
binding offers (`0x1FC9`) every 5 s for up to 60 s until the controller responds,
then sends a confirmation packet:

- **Relay** (`devRelay`): binds a relay to the HGI80 — offers
  heat-demand/actuator-check/binding, then follows up with `0x0009` and `0x1100`
  (relay settings) packets.
- **Outdoor sensor** (`devSensor`): binds the HGI80 to the controller as an
  outdoor/external sensor (`0x0002`).
- **Zone sensor** (`devZone`): binds the HGI80 as a zone temperature sensor
  (`0x30C9`), allocating a new device ID.

---

## 7. Sending emulated sensor data (gateway ID required)

Called from `RequestZoneState` (so on every zone-temp-broadcast trigger and
startup):

- **`SendExternalSensor`** (`:356`): reads the "Outside" temperature and a UV
  value from the Domoticz DB and broadcasts them as an external-sensor packet
  (`0x0002`) so the controller can use outdoor temperature.
- **`SendZoneSensor`** (`:386`): for each emulated zone sensor (units 40–51),
  reads a matching external sensor's temperature from the DB and broadcasts it as
  a zone-temp packet (`0x30C9`) on that sensor's ID, feeding real readings into
  Evohome zones.

---

## Summary of what's "over and above passive listening"

1. **On connect:** `RequestCurrentState` (full bootstrap poll) — if controller ID known.
2. **Every 1 s:** drain one queued packet; check relay refresh/keepalive timers.
3. **Every ~5 min (300 s):** re-poll all zone temps + DHW temp (normal mode), or
   run controller-detection/auto-init (startup mode); after ~1 h re-request zone
   names once.
4. **Every ~10 min (604 s):** relay actuator-check keepalive (if relays defined).
5. **Every ~20 min (1202 s):** re-broadcast each relay's heat demand.
6. **On receiving** controller temp broadcasts → poll setpoints/DHW + emit
   emulated outdoor/zone sensor data; on mode change → poll zone state; on DHW
   demand → poll DHW state; during startup, self-chaining zone-name and
   device-info enumeration walks.
7. **On user action:** mode/setpoint/DHW/relay writes.
8. **On user binding request:** repeated binding offer transmissions.

### Minimum to replicate for a comparable replacement

The **minimum** active behaviour to replicate for a comparable experience is:
the connect-time `RequestCurrentState`, the zone-temp-triggered `RequestZoneState`
(setpoint override polling), and the 5-minute per-zone temperature poll. The
relay emulation, sensor emulation, and binding are only needed if you use those
specific features.

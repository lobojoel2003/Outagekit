# @outagekit/runtime

Battery runtime math for electricity-dependent medical equipment, plus an open
JSON catalog of common devices and power stations. MIT licensed, no
dependencies, fully typed. It powers the [Outagekit](https://github.com/lobojoel2003/Outagekit)
app.

It accounts for device watts and duty cycle, inverter efficiency and idle draw,
DC outputs, battery age and charge cycles, cold-weather derating, lead-acid
losses at high draw, and self-discharge in storage.

## Install

```bash
npm install @outagekit/runtime
```

Each [GitHub release](https://github.com/lobojoel2003/Outagekit/releases) also
attaches the package as a `.tgz` you can install directly.

## Quick start

```ts
import { estimateRuntime, formatDuration } from '@outagekit/runtime';

const estimate = estimateRuntime(
  [
    { id: 'o2', name: 'Oxygen concentrator', watts: 300, priority: 'life-sustaining' },
    { id: 'cpap', name: 'CPAP, humidifier off', watts: 20, supply: 'dc', priority: 'medical' },
    { id: 'fridge', name: 'Fridge', watts: 150, dutyCycle: 0.4, idleWatts: 2, surgeWatts: 1200 },
  ],
  {
    id: 'station',
    name: 'Power station',
    capacityWh: 1024,
    chemistry: 'lifepo4',
    acOutputWatts: 1800,
    stateOfCharge: 0.9,
    ageYears: 2,
  },
  { temperatureC: 5 },
);

formatDuration(estimate.hours); // e.g. "1 hour 55 minutes"
estimate.sources[0]; // usable Wh, draw W, every derating factor
estimate.warnings; // overload, surge, low charge, cold, worn…
```

## Using the catalog

```ts
import {
  devices,
  powerSources,
  findDevice,
  loadFromCatalog,
  sourceFromCatalog,
} from '@outagekit/runtime';

const cpap = findDevice('generic-cpap')!;
const load = loadFromCatalog(cpap, { settingId: 'humidifier-off' });
```

The raw JSON is exported too, for use from any language:

```js
import devices from '@outagekit/runtime/catalog/devices.json' with { type: 'json' };
```

JSON Schemas live in `@outagekit/runtime/schema/devices.schema.json` and
`schema/power-sources.schema.json`. Every entry says whether its figures were
`verified` against a manufacturer document and lists its `sources`.

## API

| Function                                                                               | What it does                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `estimateRuntime(loads, sources, conditions?)`                                         | Hours the sources run the loads, with a full breakdown and warnings. Several sources are used one after another.         |
| `planLoadShedding(loads, sources, conditions?, options?)`                              | What to switch off first and how much time each step adds. Never suggests medical or life-sustaining devices by default. |
| `leaveAfterHours(runtimeHours, { travelMinutes, marginMinutes })`                      | When to leave so you arrive with time to spare.                                                                          |
| `summarizeLoads(loads)` / `averageWatts(load)`                                         | Average, peak and start-up draw.                                                                                         |
| `stateOfHealth(source)` / `temperatureFactor(chem, °C)` / `peukertFactor(chem, Wh, W)` | The individual derating factors.                                                                                         |
| `estimateStoredCharge({ chemistry, daysSinceCharge })`                                 | Charge left after sitting unused.                                                                                        |
| `chargeReminder({ lastChargedAt, intervalDays })`                                      | When the next top-up is due.                                                                                             |
| `rechargeHours(capacityWh, chargerWatts)`                                              | How long a recharge takes.                                                                                               |
| `oxygenCylinderHours({ cylinder: 'E', flowLpm: 2, count: 2 })`                         | How long backup oxygen lasts.                                                                                            |
| `formatDuration(hours, 'long' \| 'short' \| 'clock')`                                  | "7 hours 20 minutes", "7 h 20 min", "7:20". Always rounds down.                                                          |
| `ampHoursToWattHours`, `voltAmpsToWatts`, `celsiusToFahrenheit`, …                     | Unit helpers.                                                                                                            |
| `validateCatalog({ devices, powerSources })`                                           | Check catalog data; returns a list of problems.                                                                          |

The method, every default and its reasoning are documented in
[docs/METHOD.md](https://github.com/lobojoel2003/Outagekit/blob/main/docs/METHOD.md).

## Important

Results are estimates to help people plan. They are not medical advice and
not a guarantee. Always test a real setup and keep a backup plan.

## License

MIT © Joel Stain Lobo and Outagekit contributors. The Outagekit app that uses
this library is GPL-3.0.

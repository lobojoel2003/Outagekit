# How Outagekit works out runtime

Outagekit answers one question: _if the power went out now, how long would this
battery keep these devices running?_ This page explains every step of the
calculation so anyone can check it. The code is in
[`packages/runtime`](../packages/runtime/src) (MIT licensed) and every step
below has unit tests.

> **Estimates, not guarantees.** Real devices vary with settings, altitude,
> age and temperature. Test your own setup for at least 30 minutes, and always
> have a plan for when the battery runs out.

## 1. Average draw of each device

```
average W = (running W × duty cycle + standby W × (1 − duty cycle)) × quantity
```

- **Running W** is the draw at the chosen setting. Catalog figures are average
  draw at the wall, not the power supply's nameplate maximum, which is often
  two to three times higher.
- **Duty cycle** is the share of time a device draws its running power. An
  oxygen concentrator runs all the time (1.0); a refrigerator compressor
  cycles on and off (about 0.3 to 0.5); a powered bed's motor runs for a few
  minutes a day.
- Devices that are switched off count as zero.

## 2. Power drawn from the battery

Devices plugged into AC outlets go through the inverter, which wastes some
power converting and uses some just by being on:

```
AC draw = inverter idle W + AC devices W ÷ inverter efficiency
DC draw = DC devices W ÷ DC efficiency
battery draw = AC draw + DC draw
```

| Source type        | Inverter efficiency | Inverter idle draw           | DC efficiency |
| ------------------ | ------------------- | ---------------------------- | ------------- |
| Power station      | 90%                 | 0.6% of rating, at least 5 W | 92%           |
| Battery + inverter | 88%                 | 1% of rating, at least 6 W   | 95%           |
| UPS                | 80%                 | 1.2% of rating, at least 8 W | none          |

The idle draw is why small loads on a big inverter run for less time than a
simple "watt-hours ÷ watts" sum suggests. A UPS has no DC outputs, so DC
devices are counted through their own AC adapter (85% efficient).

Running a CPAP or other DC-capable device from a 12 V outlet instead of an AC
outlet skips the inverter and usually adds meaningful runtime.

## 3. Energy the battery can actually deliver

```
usable Wh = nameplate Wh × charge × usable share × health × temperature × high-draw factor
```

| Factor         | Meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Charge         | 0 to 100%. Falls by the self-discharge rate while the battery sits idle. |
| Usable share   | How much can be drawn before the battery protects itself and cuts off.   |
| Health         | Capacity left after age and charge cycles, or a measured value.          |
| Temperature    | Cold batteries deliver less energy.                                      |
| High-draw loss | Lead-acid batteries deliver less when drained quickly (Peukert's law).   |

### Chemistry defaults

| Chemistry       | Usable share | Fade per year | Cycles to 80% | Self-discharge per month | Peukert exponent |
| --------------- | ------------ | ------------- | ------------- | ------------------------ | ---------------- |
| LiFePO4         | 95%          | 2%            | 3,000         | 3%                       | 1.00             |
| Lithium-ion NMC | 95%          | 3%            | 500           | 3%                       | 1.00             |
| AGM lead-acid   | 80%          | 5%            | 400           | 3%                       | 1.15             |
| Gel lead-acid   | 80%          | 4%            | 500           | 3%                       | 1.12             |
| Flooded         | 80%          | 6%            | 300           | 5%                       | 1.25             |

Self-discharge includes the small standby draw of a power station's own
electronics, which is why it is higher than bare cell figures. Lead-acid's
usable share of 80% reflects emergency use; regular deep discharge shortens
its life, which the health factor then captures.

**Health** = 1 − (fade per year × age) − (20% × cycles ÷ cycles to 80%),
never modelled below 30%. A manufacturer's cycle rating or a measured state of
health replaces the defaults.

**Temperature** factors are interpolated from these points and held flat
beyond the ends:

| °C        | −20  | −10  | 0    | 10   | 20 and above |
| --------- | ---- | ---- | ---- | ---- | ------------ |
| LiFePO4   | 0.55 | 0.70 | 0.82 | 0.92 | 1.00         |
| NMC       | 0.60 | 0.74 | 0.85 | 0.94 | 1.00         |
| Lead-acid | 0.50 | 0.65 | 0.78 | 0.90 | 1.00         |

Lithium batteries must not be recharged below 0 °C; Outagekit warns about this.
Above 40 °C it warns that the battery may shut down to protect itself.

**High-draw factor** applies only to lead-acid, rated over 20 hours:
`(rated W ÷ draw W)^(k − 1)` when the draw is above the rated W, otherwise 1.
Outagekit never gives a bonus for light loads.

## 4. Runtime

```
runtime hours = usable Wh ÷ battery draw W
```

With more than one battery, Outagekit assumes you move the plugs to the next
one when the first runs out, so their runtimes add up. The dial rounds **down**
to the nearest 5 minutes (1 minute under an hour), so it never shows more time
than the estimate.

## 5. The plan

- **Switch off first.** Comfort devices go first, then essential ones, biggest
  average draw first, because that buys the most time. Medical and
  life-sustaining devices are never suggested.
- **Turn down.** Only safe suggestions: for example turning off a CPAP's
  heated humidifier, which is usually most of its draw. Outagekit never
  suggests lowering a prescribed oxygen flow or ventilator setting.
- **When to leave.** `runtime − travel time − margin` (margin defaults to 60
  minutes), so you set off with time to spare. If that is zero, the plan says
  to leave as soon as the power goes out.
- **Backup oxygen.** `litres × cylinders × 90% ÷ flow ÷ 60`, keeping 10% in
  reserve. A typical full E cylinder holds about 680 L and a D cylinder about
  425 L; check the label on yours.

## 6. During an outage

"Power is out" records the start time and each battery's charge. The countdown
tracks the share of energy left. When you switch something off mid-outage, the
time already used is counted at the old rate and the rest at the new rate. If
you read the charge from your battery's display, entering it resets the
countdown from that reading.

## 7. Warnings

Outagekit warns when everything running at once would exceed the inverter's
continuous rating, when a motor or compressor's start-up surge may trip it,
when a battery is under 50% charged, when health is under 80%, when the cold
cuts capacity, and when life-sustaining equipment has under 4 hours.

## Sources for the defaults

The chemistry figures are conservative round numbers consistent with typical
cell data sheets and power station manuals; they are deliberately simple so they
are easy to check and to improve. Device figures carry their own sources in the
[catalog](catalog.md). Corrections with a manufacturer document are welcome.

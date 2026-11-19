import {
  ampHoursToWattHours,
  celsiusToFahrenheit,
  chemistryProfile,
  fahrenheitToCelsius,
  powerSources,
  displayName,
  type SourceRuntime,
} from '@outagekit/runtime';
import { useState } from 'react';
import { currentCharge } from '../lib/compute';
import { formatDate, formatPercent, formatWatts, formatWh, formatDuration } from '../lib/format';
import { customSource, sourceFromCatalogEntry } from '../state/factories';
import { useStore } from '../state/store';
import type { SourceEntry } from '../state/types';
import { NumberField, Section, Segmented, SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { CHEMISTRY_OPTIONS, KIND_OPTIONS } from './labels';

const CUSTOM = '__custom__';

function Breakdown({ runtime }: { runtime: SourceRuntime }) {
  const rows: Array<[string, string]> = [
    ['Nameplate capacity', formatWh(runtime.nameplateWh)],
    ['× charge now', formatPercent(runtime.stateOfCharge)],
    ['× usable before cut-off', formatPercent(runtime.usableFraction)],
    ['× battery health (age, cycles)', formatPercent(runtime.health)],
    ['× temperature', formatPercent(runtime.temperatureFactor)],
  ];
  if (runtime.peukertFactor < 0.999)
    rows.push(['× high-draw loss (lead-acid)', formatPercent(runtime.peukertFactor)]);
  return (
    <details className="breakdown">
      <summary>How this is worked out</summary>
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
          <tr className="breakdown-total">
            <th scope="row">Energy you can use</th>
            <td>{formatWh(runtime.usableWh)}</td>
          </tr>
          <tr>
            <th scope="row">Devices (average)</th>
            <td>{formatWatts(runtime.acLoadW + runtime.dcLoadW)}</td>
          </tr>
          <tr>
            <th scope="row">+ inverter running itself</th>
            <td>{formatWatts(runtime.inverterIdleW)}</td>
          </tr>
          <tr>
            <th scope="row">+ conversion loss</th>
            <td>{formatWatts(runtime.conversionLossW)}</td>
          </tr>
          <tr className="breakdown-total">
            <th scope="row">Drawn from the battery</th>
            <td>{formatWatts(runtime.drawW)}</td>
          </tr>
          <tr className="breakdown-total">
            <th scope="row">Runtime (energy ÷ draw)</th>
            <td>{formatDuration(runtime.hours)}</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function SourceCard({
  source,
  runtime,
  index,
}: {
  source: SourceEntry;
  runtime?: SourceRuntime;
  index: number;
}) {
  const { state, dispatch, now } = useStore();
  const [custom, setCustom] = useState(source.catalogId === null);
  const [ampHours, setAmpHours] = useState(100);
  const [volts, setVolts] = useState(12.8);
  const update = (patch: Partial<SourceEntry>) =>
    dispatch({ type: 'source/update', uid: source.uid, patch });
  const charge = state.outage?.chargeAtStart[source.uid] ?? currentCharge(source, now);
  const profile = chemistryProfile(source.chemistry);

  const choose = (id: string) => {
    if (id === CUSTOM) {
      setCustom(true);
      update({ catalogId: null });
      return;
    }
    const item = powerSources.find((s) => s.id === id);
    if (!item) return;
    setCustom(false);
    const fresh = sourceFromCatalogEntry(item, now);
    update({
      catalogId: item.id,
      name: fresh.name,
      kind: fresh.kind,
      capacityWh: fresh.capacityWh,
      chemistry: fresh.chemistry,
      acOutputWatts: fresh.acOutputWatts,
      acSurgeWatts: fresh.acSurgeWatts,
      cycleLifeTo80: fresh.cycleLifeTo80,
    });
  };

  return (
    <li className="source" data-testid="source">
      <div className="source-head">
        <Icon name="battery" size={22} />
        <h3>{index === 0 ? 'Battery' : `Battery ${index + 1}`}</h3>
        {state.sources.length > 1 && (
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove ${source.name}`}
            onClick={() => dispatch({ type: 'source/remove', uid: source.uid })}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
      </div>

      <SelectField
        label="Battery or power station"
        value={custom ? CUSTOM : (source.catalogId ?? CUSTOM)}
        options={[
          ...powerSources.map((s) => ({
            value: s.id,
            label: `${displayName(s)} · ${s.capacityWh.toLocaleString('en-US')} Wh`,
          })),
          { value: CUSTOM, label: 'Something else (enter it)' },
        ]}
        onChange={choose}
      />

      {custom && (
        <div className="source-custom">
          <TextField label="Name" value={source.name} onChange={(name) => update({ name })} />
          <SelectField
            label="Type"
            value={source.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => update({ kind })}
          />
          <SelectField
            label="Battery chemistry"
            value={source.chemistry}
            options={CHEMISTRY_OPTIONS}
            onChange={(chemistry) => update({ chemistry })}
          />
          <NumberField
            label="Capacity"
            value={source.capacityWh}
            min={1}
            max={100000}
            unit="Wh"
            onChange={(capacityWh) => update({ capacityWh })}
          />
          <details className="ah-helper">
            <summary>Only know amp-hours?</summary>
            <div className="row">
              <NumberField
                label="Amp-hours"
                value={ampHours}
                min={0}
                unit="Ah"
                onChange={setAmpHours}
              />
              <NumberField label="Volts" value={volts} min={0} unit="V" onChange={setVolts} />
              <button
                type="button"
                className="button"
                onClick={() =>
                  update({ capacityWh: Math.round(ampHoursToWattHours(ampHours, volts)) })
                }
              >
                Use {Math.round(ampHoursToWattHours(ampHours, volts)).toLocaleString('en-US')} Wh
              </button>
            </div>
          </details>
          <NumberField
            label="AC output rating"
            value={source.acOutputWatts ?? 0}
            min={0}
            max={20000}
            unit="W"
            hint="The continuous watts its outlets can supply. 0 if unknown."
            onChange={(watts) => update({ acOutputWatts: watts > 0 ? watts : null })}
          />
        </div>
      )}

      <div className="field charge">
        <label htmlFor={`${source.uid}-charge`}>
          Charge {state.outage ? 'when the outage began' : 'now'}:{' '}
          <strong>{formatPercent(charge)}</strong>
        </label>
        <input
          id={`${source.uid}-charge`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(charge * 100)}
          onChange={(event) =>
            dispatch({
              type: 'source/charge',
              uid: source.uid,
              chargedTo: Number(event.target.value) / 100,
            })
          }
        />
        <p className="hint">
          {state.outage
            ? 'Read the display on your battery and set it here to correct the countdown.'
            : `Last charged ${formatDate(source.lastChargedAt)}. Batteries lose about ${formatPercent(profile.selfDischargePerMonth)} a month sitting unused.`}
        </p>
        {!state.outage && (
          <button
            type="button"
            className="button button-quiet"
            onClick={() => dispatch({ type: 'source/charge', uid: source.uid, chargedTo: 1 })}
          >
            <Icon name="check" size={16} /> I charged it to full today
          </button>
        )}
      </div>

      <div className="row">
        <NumberField
          label="Age"
          value={source.ageYears}
          min={0}
          max={30}
          step={0.5}
          unit="years"
          onChange={(ageYears) => update({ ageYears })}
        />
        <NumberField
          label="Times fully used"
          value={source.cycles}
          min={0}
          max={20000}
          step={10}
          unit="cycles"
          onChange={(cycles) => update({ cycles })}
        />
      </div>

      {runtime && <Breakdown runtime={runtime} />}
    </li>
  );
}

export function BatteryPanel() {
  const { state, dispatch, computed, now } = useStore();
  const unit = state.settings.temperatureUnit;
  const shown =
    unit === 'F' ? celsiusToFahrenheit(state.settings.temperatureC) : state.settings.temperatureC;
  return (
    <Section
      id="battery"
      title="Your battery"
      description="Pick your power station or battery. Charge, age and cold all change the runtime."
      action={
        <button
          type="button"
          className="button"
          onClick={() => dispatch({ type: 'source/add', source: customSource(now) })}
        >
          <Icon name="plus" size={18} /> Add battery
        </button>
      }
    >
      <ul className="source-list">
        {state.sources.map((source, index) => (
          <SourceCard
            key={source.uid}
            source={source}
            index={index}
            runtime={computed.estimate.sources.find((s) => s.sourceId === source.uid)}
          />
        ))}
      </ul>
      {state.sources.length > 1 && (
        <p className="hint">
          With more than one battery, the runtimes add up: move the plugs to the next one when the
          first runs out.
        </p>
      )}

      <div className="temperature">
        <NumberField
          label="Temperature where the battery is kept"
          value={Math.round(shown)}
          min={unit === 'F' ? -40 : -40}
          max={unit === 'F' ? 130 : 55}
          unit={`°${unit}`}
          hint="Cold batteries hold less. Keep yours indoors, off cold floors."
          onChange={(value) =>
            dispatch({
              type: 'settings/update',
              patch: { temperatureC: unit === 'F' ? fahrenheitToCelsius(value) : value },
            })
          }
        />
        <Segmented
          label="Units"
          value={unit}
          options={[
            { value: 'F', label: '°F' },
            { value: 'C', label: '°C' },
          ]}
          onChange={(temperatureUnit) =>
            dispatch({ type: 'settings/update', patch: { temperatureUnit } })
          }
        />
      </div>
    </Section>
  );
}

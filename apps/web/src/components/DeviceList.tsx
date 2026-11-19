import { averageWatts, CATEGORY_LABELS, findDevice } from '@outagekit/runtime';
import { useState } from 'react';
import { toLoad } from '../lib/compute';
import { formatWatts } from '../lib/format';
import { useStore } from '../state/store';
import type { DeviceEntry } from '../state/types';
import { AddDeviceDialog } from './AddDeviceDialog';
import { NumberField, Section, Segmented, SelectField, Switch, TextField } from './fields';
import { Icon } from './Icon';
import { PRIORITY_LABEL, PRIORITY_OPTIONS, SUPPLY_OPTIONS } from './labels';

function DeviceCard({ device }: { device: DeviceEntry }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const catalog = device.catalogId ? findDevice(device.catalogId) : undefined;
  const update = (patch: Partial<DeviceEntry>) =>
    dispatch({ type: 'device/update', uid: device.uid, patch });
  const average = averageWatts({ ...toLoad(device), enabled: true });

  return (
    <li className={`device ${device.enabled ? '' : 'device-off'}`} data-testid="device">
      <div className="device-top">
        <Switch
          checked={device.enabled}
          onChange={(enabled) => update({ enabled })}
          label={`${device.name} switched on`}
        />
        <div className="device-title">
          <h3>{device.name}</h3>
          <p className="device-meta">
            <span className={`badge badge-${device.priority}`}>
              {PRIORITY_LABEL[device.priority]}
            </span>
            <span>{CATEGORY_LABELS[device.category]}</span>
          </p>
        </div>
        <div className="device-watts" aria-label={`Average ${formatWatts(average)}`}>
          <strong>{formatWatts(average)}</strong>
          <span>average</span>
        </div>
      </div>

      <div className="device-controls">
        {catalog && catalog.settings.length > 1 && device.settingId ? (
          <SelectField
            label="Setting"
            value={device.settingId}
            options={catalog.settings.map((s) => ({
              value: s.id,
              label: `${s.label} · ${formatWatts(s.watts)}`,
            }))}
            onChange={(settingId) =>
              dispatch({ type: 'device/setting', uid: device.uid, settingId })
            }
          />
        ) : (
          <NumberField
            label="Watts while running"
            value={device.watts}
            min={0}
            max={5000}
            unit="W"
            onChange={(watts) => update({ watts, settingId: catalog ? device.settingId : null })}
          />
        )}
        <div className="field quantity">
          <span className="field-label" id={`${device.uid}-qty`}>
            How many
          </span>
          <div className="stepper" role="group" aria-labelledby={`${device.uid}-qty`}>
            <button
              type="button"
              aria-label="One fewer"
              onClick={() => update({ quantity: Math.max(1, device.quantity - 1) })}
              disabled={device.quantity <= 1}
            >
              <Icon name="minus" size={16} />
            </button>
            <output aria-live="polite">{device.quantity}</output>
            <button
              type="button"
              aria-label="One more"
              onClick={() => update({ quantity: Math.min(20, device.quantity + 1) })}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="link-button device-more"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Fewer options' : 'More options'}
      </button>

      {open && (
        <div className="device-details">
          <TextField label="Name" value={device.name} onChange={(name) => update({ name })} />
          <SelectField
            label="Importance"
            value={device.priority}
            options={PRIORITY_OPTIONS}
            onChange={(priority) => update({ priority })}
          />
          <Segmented
            label="Plugged into"
            value={device.supply}
            options={SUPPLY_OPTIONS}
            onChange={(supply) => update({ supply })}
          />
          <NumberField
            label="Running share of the time"
            value={Math.round(device.dutyCycle * 100)}
            min={1}
            max={100}
            unit="%"
            hint="100% for devices that run all the time. A fridge compressor runs about 40%."
            onChange={(percent) => update({ dutyCycle: percent / 100 })}
          />
          <NumberField
            label="Standby draw"
            value={device.idleWatts}
            min={0}
            max={500}
            unit="W"
            onChange={(idleWatts) => update({ idleWatts })}
          />
          {catalog && (
            <div className="device-source">
              {catalog.notes && <p>{catalog.notes}</p>}
              <p className={catalog.verified ? 'verified' : 'unverified'}>
                <Icon name={catalog.verified ? 'check' : 'info'} size={16} />
                {catalog.verified
                  ? 'Figures from the manufacturer’s manual.'
                  : 'Typical figure. Check the label or manual for your device.'}
              </p>
              {catalog.sources
                .filter((s) => s.url)
                .map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ))}
            </div>
          )}
          <button
            type="button"
            className="button button-quiet button-danger"
            onClick={() => dispatch({ type: 'device/remove', uid: device.uid })}
          >
            <Icon name="trash" size={16} /> Remove {device.name}
          </button>
        </div>
      )}
    </li>
  );
}

export function DeviceList() {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <Section
      id="devices"
      title="Your devices"
      description="Switch a device off to see how much longer the battery lasts."
      action={
        <button type="button" className="button" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Add device
        </button>
      }
    >
      {state.devices.length === 0 ? (
        <div className="empty">
          <p>
            Add the devices you need to keep running in an outage, starting with medical equipment.
          </p>
          <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Add your first device
          </button>
        </div>
      ) : (
        <ul className="device-list">
          {state.devices.map((device) => (
            <DeviceCard key={device.uid} device={device} />
          ))}
        </ul>
      )}
      {adding && <AddDeviceDialog onClose={() => setAdding(false)} />}
    </Section>
  );
}

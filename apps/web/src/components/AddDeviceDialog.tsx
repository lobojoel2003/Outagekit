import {
  CATEGORY_LABELS,
  DEVICE_CATEGORIES,
  devices as catalog,
  displayName,
  settingOf,
  type CatalogDevice,
  type DeviceCategory,
  type Priority,
  type Supply,
} from '@outagekit/runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatWatts } from '../lib/format';
import { customDevice, deviceFromCatalog } from '../state/factories';
import { useStore } from '../state/store';
import { NumberField, Segmented, SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { PRIORITY_LABEL, PRIORITY_OPTIONS, SUPPLY_OPTIONS } from './labels';

const MEDICAL_FIRST: DeviceCategory[] = [...DEVICE_CATEGORIES];

/** Everyday words people search with, by category. */
const ALIASES: Partial<Record<DeviceCategory, string>> = {
  'oxygen-concentrator': 'oxygen o2 concentrator',
  'portable-oxygen-concentrator': 'oxygen o2 poc portable concentrator',
  cpap: 'cpap apap sleep apnea breathing machine',
  bilevel: 'bipap bpap bilevel sleep apnea',
  ventilator: 'ventilator vent breathing trach',
  bed: 'hospital bed powered bed',
  mattress: 'mattress air pressure alternating low air loss bed sores',
  suction: 'suction aspirator',
  nebulizer: 'nebulizer neb breathing treatment',
  'feeding-pump': 'feeding pump enteral tube g-tube',
  'infusion-pump': 'infusion iv pump',
  dialysis: 'dialysis kidney cycler',
  mobility: 'wheelchair scooter lift stairlift charger',
  monitor: 'monitor oximeter apnea alarm',
  refrigeration: 'fridge refrigerator freezer insulin cooler medicine',
  communication: 'phone mobile cell router wifi internet modem laptop charger',
  lighting: 'light lamp bulb',
  climate: 'heater fan air conditioner ac cooling heating',
};

function matches(device: CatalogDevice, query: string): boolean {
  if (!query) return true;
  const haystack =
    `${displayName(device)} ${CATEGORY_LABELS[device.category]} ${ALIASES[device.category] ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function AddDeviceDialog({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [watts, setWatts] = useState(50);
  const [priority, setPriority] = useState<Priority>('medical');
  const [supply, setSupply] = useState<Supply>('ac');

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    }
  }, []);

  const groups = useMemo(() => {
    const found = catalog.filter((device) => matches(device, query.trim()));
    return MEDICAL_FIRST.map((category) => ({
      category,
      items: found.filter((device) => device.category === category),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const add = (device: CatalogDevice) => {
    dispatch({ type: 'device/add', device: deviceFromCatalog(device) });
    onClose();
  };

  const addCustom = () => {
    dispatch({
      type: 'device/add',
      device: customDevice({ name: name.trim() || 'My device', watts, priority, supply }),
    });
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="add-device-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <header className="dialog-header">
        <h2 id="add-device-title">Add a device</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>

      <Segmented
        label="Where from"
        value={custom ? 'custom' : 'catalog'}
        options={[
          { value: 'catalog', label: 'From the catalog' },
          { value: 'custom', label: 'Enter my own' },
        ]}
        onChange={(value) => setCustom(value === 'custom')}
      />

      {custom ? (
        <form
          className="dialog-body custom-device"
          onSubmit={(event) => {
            event.preventDefault();
            addCustom();
          }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Suction machine"
          />
          <NumberField
            label="Watts while running"
            value={watts}
            min={0}
            max={5000}
            unit="W"
            onChange={setWatts}
            hint="Look on the label or in the manual. If it lists amps, multiply by 120 (US) for watts; that is a maximum, so the real draw is usually lower."
          />
          <SelectField
            label="Importance"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={setPriority}
          />
          <Segmented
            label="Plugged into"
            value={supply}
            options={SUPPLY_OPTIONS}
            onChange={setSupply}
          />
          <button type="submit" className="button button-primary">
            <Icon name="plus" size={18} /> Add {name.trim() || 'device'}
          </button>
        </form>
      ) : (
        <div className="dialog-body">
          <div className="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="Search devices"
              placeholder="Search: oxygen, CPAP, Trilogy, fridge…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          {groups.length === 0 && (
            <p className="empty">
              Nothing matches “{query}”. Choose <strong>Enter my own</strong> and type the watts
              from its label.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.category} className="catalog-group">
              <h3>{CATEGORY_LABELS[group.category]}</h3>
              <ul>
                {group.items.map((device) => {
                  const setting = settingOf(device);
                  return (
                    <li key={device.id}>
                      <button type="button" className="catalog-item" onClick={() => add(device)}>
                        <span className="catalog-name">{displayName(device)}</span>
                        <span className="catalog-meta">
                          {formatWatts(setting.watts)}
                          {device.settings.length > 1 ? ` at ${setting.label}` : ''} ·{' '}
                          {PRIORITY_LABEL[device.priority]}
                          {device.verified ? ' · manual' : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </dialog>
  );
}

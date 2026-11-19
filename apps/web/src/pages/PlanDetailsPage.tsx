import { formatDuration } from '@outagekit/runtime';
import { NumberField, Section, Segmented, SelectField, TextField } from '../components/fields';
import { Icon } from '../components/Icon';
import { hrefFor } from '../lib/router';
import { newId } from '../state/ids';
import { useStore } from '../state/store';
import type { OxygenBackup, Profile } from '../state/types';

export function PlanDetailsPage() {
  const { state, dispatch, computed } = useStore();
  const profile = state.profile;
  const update = (patch: Partial<Profile>) => dispatch({ type: 'profile/update', patch });
  const oxygen = profile.oxygen;
  const updateOxygen = (patch: Partial<OxygenBackup>) =>
    oxygen && update({ oxygen: { ...oxygen, ...patch } });

  return (
    <div className="page">
      <header className="page-header">
        <h1>Plan details</h1>
        <p>
          This goes on the fridge card, so a neighbor, relative or first responder knows what to do.
          It is stored only on this device.
        </p>
      </header>

      <Section id="person" title="Who the plan is for">
        <div className="grid-2">
          <TextField
            label="Name"
            value={profile.personName}
            onChange={(personName) => update({ personName })}
            autoComplete="name"
          />
          <TextField
            label="Phone"
            type="tel"
            value={profile.phone}
            onChange={(phone) => update({ phone })}
            autoComplete="tel"
          />
        </div>
        <TextField
          label="Home address"
          value={profile.address}
          onChange={(address) => update({ address })}
          autoComplete="street-address"
        />
        <TextField
          label="Medical note for responders"
          value={profile.medicalNote}
          onChange={(medicalNote) => update({ medicalNote })}
          placeholder="e.g. COPD. Oxygen 2 L/min around the clock. Uses CPAP at night."
          multiline
        />
        <TextField
          label="Where equipment and supplies are kept"
          value={profile.equipmentLocation}
          onChange={(equipmentLocation) => update({ equipmentLocation })}
          placeholder="e.g. Power station in the hall closet; oxygen cylinders in the bedroom"
        />
      </Section>

      <Section
        id="utility"
        title="Electric utility"
        description="Many utilities run a medical baseline or priority list. Register before the next outage."
      >
        <div className="grid-3">
          <TextField
            label="Utility"
            value={profile.utilityName}
            onChange={(utilityName) => update({ utilityName })}
          />
          <TextField
            label="Outage line"
            type="tel"
            value={profile.utilityPhone}
            onChange={(utilityPhone) => update({ utilityPhone })}
          />
          <TextField
            label="Account number"
            value={profile.utilityAccount}
            onChange={(utilityAccount) => update({ utilityAccount })}
          />
        </div>
      </Section>

      <Section
        id="destinations"
        title="Where to go"
        description="The first place is used to work out when to leave."
        action={
          <button
            type="button"
            className="button"
            onClick={() =>
              dispatch({
                type: 'destination/add',
                destination: {
                  id: newId('dst'),
                  name: '',
                  address: '',
                  phone: '',
                  travelMinutes: 30,
                },
              })
            }
          >
            <Icon name="plus" size={18} /> Add place
          </button>
        }
      >
        {profile.destinations.length === 0 && (
          <p className="empty">
            Add a relative or friend with power, a hospital, or a community cooling or warming
            center.
          </p>
        )}
        <ul className="card-list">
          {profile.destinations.map((destination, index) => (
            <li key={destination.id} className="card">
              <div className="card-head">
                <h3>{index === 0 ? 'First choice' : `Option ${index + 1}`}</h3>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${destination.name || 'place'}`}
                  onClick={() => dispatch({ type: 'destination/remove', id: destination.id })}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <div className="grid-2">
                <TextField
                  label="Place"
                  value={destination.name}
                  placeholder="e.g. Maria's house"
                  onChange={(name) =>
                    dispatch({ type: 'destination/update', id: destination.id, patch: { name } })
                  }
                />
                <TextField
                  label="Phone"
                  type="tel"
                  value={destination.phone}
                  onChange={(phone) =>
                    dispatch({ type: 'destination/update', id: destination.id, patch: { phone } })
                  }
                />
              </div>
              <TextField
                label="Address"
                value={destination.address}
                onChange={(address) =>
                  dispatch({ type: 'destination/update', id: destination.id, patch: { address } })
                }
              />
              <NumberField
                label="Travel time"
                value={destination.travelMinutes}
                min={0}
                max={600}
                unit="min"
                onChange={(travelMinutes) =>
                  dispatch({
                    type: 'destination/update',
                    id: destination.id,
                    patch: { travelMinutes },
                  })
                }
              />
            </li>
          ))}
        </ul>
        <NumberField
          label="Time to keep in hand"
          value={state.settings.marginMinutes}
          min={0}
          max={600}
          step={15}
          unit="min"
          hint="Extra battery time left when you set off, for traffic and delays."
          onChange={(marginMinutes) =>
            dispatch({ type: 'settings/update', patch: { marginMinutes } })
          }
        />
      </Section>

      <Section
        id="contacts"
        title="Who to call"
        action={
          <button
            type="button"
            className="button"
            onClick={() =>
              dispatch({
                type: 'contact/add',
                contact: { id: newId('con'), name: '', relation: '', phone: '' },
              })
            }
          >
            <Icon name="plus" size={18} /> Add contact
          </button>
        }
      >
        {profile.contacts.length === 0 && (
          <p className="empty">
            Add family, a neighbor, the equipment supplier and the doctor’s office.
          </p>
        )}
        <ul className="card-list">
          {profile.contacts.map((contact) => (
            <li key={contact.id} className="card contact">
              <TextField
                label="Name"
                value={contact.name}
                onChange={(name) =>
                  dispatch({ type: 'contact/update', id: contact.id, patch: { name } })
                }
              />
              <TextField
                label="Who they are"
                value={contact.relation}
                placeholder="e.g. Daughter, Oxygen supplier"
                onChange={(relation) =>
                  dispatch({ type: 'contact/update', id: contact.id, patch: { relation } })
                }
              />
              <TextField
                label="Phone"
                type="tel"
                value={contact.phone}
                onChange={(phone) =>
                  dispatch({ type: 'contact/update', id: contact.id, patch: { phone } })
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${contact.name || 'contact'}`}
                onClick={() => dispatch({ type: 'contact/remove', id: contact.id })}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="oxygen"
        title="Backup oxygen"
        description="If you have oxygen cylinders, the plan says how long they last once the battery is empty."
      >
        <Segmented
          label="Oxygen cylinders at home"
          value={oxygen ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'None' },
            { value: 'yes', label: 'Yes' },
          ]}
          onChange={(value) =>
            update({
              oxygen:
                value === 'yes'
                  ? (oxygen ?? {
                      cylinderCount: 2,
                      cylinderSize: 'E',
                      customLitres: 600,
                      flowLpm: 2,
                    })
                  : null,
            })
          }
        />
        {oxygen && (
          <>
            <div className="grid-3">
              <NumberField
                label="Full cylinders"
                value={oxygen.cylinderCount}
                min={0}
                max={50}
                step={1}
                onChange={(cylinderCount) => updateOxygen({ cylinderCount })}
              />
              <SelectField
                label="Size"
                value={oxygen.cylinderSize}
                options={[
                  { value: 'E', label: 'E (about 680 L)' },
                  { value: 'D', label: 'D (about 425 L)' },
                  { value: 'custom', label: 'Other (enter litres)' },
                ]}
                onChange={(cylinderSize) => updateOxygen({ cylinderSize })}
              />
              <NumberField
                label="Prescribed flow"
                value={oxygen.flowLpm}
                min={0.1}
                max={15}
                step={0.5}
                unit="L/min"
                onChange={(flowLpm) => updateOxygen({ flowLpm })}
              />
            </div>
            {oxygen.cylinderSize === 'custom' && (
              <NumberField
                label="Litres per cylinder"
                value={oxygen.customLitres}
                min={1}
                max={10000}
                unit="L"
                onChange={(customLitres) => updateOxygen({ customLitres })}
              />
            )}
            {computed.oxygenHours !== null && (
              <p className="callout">
                Your cylinders last about <strong>{formatDuration(computed.oxygenHours)}</strong> at
                continuous flow, keeping 10% in reserve. A conserving regulator makes them last
                longer.
              </p>
            )}
          </>
        )}
      </Section>

      <Section id="notes" title="Anything else">
        <TextField
          label="Notes for the card"
          value={profile.extraNotes}
          onChange={(extraNotes) => update({ extraNotes })}
          placeholder="e.g. Spare key with neighbor at no. 12. Dog is friendly."
          multiline
        />
      </Section>

      <p className="page-footer-action">
        <a className="button button-primary button-large" href={hrefFor('card')}>
          <Icon name="card" /> See the fridge card
        </a>
      </p>
    </div>
  );
}

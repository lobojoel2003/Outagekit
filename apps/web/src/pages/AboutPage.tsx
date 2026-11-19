import { catalogUpdated, devices, powerSources } from '@outagekit/runtime';
import { useState } from 'react';
import { Section } from '../components/fields';
import { Icon } from '../components/Icon';
import { pickTextFile, saveFile } from '../lib/files';
import { BUILD_DATE, VERSION_LABEL } from '../lib/version';
import { exportState, importState } from '../state/persist';
import { useStore } from '../state/store';

const REPO = 'https://github.com/lobojoel2003/Outagekit';

export function AboutPage() {
  const { state, dispatch } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  const verified = devices.filter((d) => d.verified).length;

  return (
    <div className="page">
      <header className="page-header">
        <h1>About Outagekit</h1>
        <p>
          For people on oxygen, CPAP, a ventilator, a powered bed or other electric medical
          equipment, a power cut is an emergency with a countdown. Outagekit tells you how long your
          battery will run your devices, what to switch off first, and when to leave.
        </p>
      </header>

      <Section id="important" title="Please read">
        <ul className="checklist">
          <li>
            Runtimes are <strong>estimates</strong>. Real devices draw more at higher settings, when
            starting up and when batteries are old or cold. Test your own setup before you rely on
            it.
          </li>
          <li>
            Outagekit is not medical advice. Never change a prescribed setting to save power without
            your clinician.
          </li>
          <li>In an emergency call 911 (or your local emergency number).</li>
        </ul>
      </Section>

      <Section id="how" title="How it works">
        <p>
          For each device it takes the watts at your chosen setting and how much of the time it
          runs. For the battery it starts from the nameplate capacity and allows for the charge
          level, the share that can be used before it cuts off, age and charge cycles, temperature
          and, for lead-acid, losses at high draw. AC devices go through the inverter, which loses
          some power and uses some itself. Usable energy divided by the power drawn gives the
          runtime.
        </p>
        <p>
          The device catalog lists {devices.length} devices ({verified} checked against manufacturer
          manuals) and {powerSources.length} power sources, last reviewed {catalogUpdated}. The
          method is written up in{' '}
          <a href={`${REPO}/blob/main/docs/METHOD.md`} target="_blank" rel="noreferrer">
            docs/METHOD.md
          </a>
          .
        </p>
      </Section>

      <Section id="privacy" title="Your data">
        <p>
          Everything stays on this device. Nothing is sent anywhere, and the app works with no
          internet connection. Keep a backup file in case you change phones.
        </p>
        <div className="reminder-actions">
          <button
            type="button"
            className="button"
            onClick={() =>
              void saveFile('outagekit-backup.json', exportState(state), 'application/json')
            }
          >
            <Icon name="download" size={18} /> Save a backup
          </button>
          <button
            type="button"
            className="button"
            onClick={async () => {
              const text = await pickTextFile();
              if (text === null) return;
              const imported = importState(text);
              if (imported) {
                dispatch({ type: 'state/replace', state: imported });
                setMessage('Backup restored.');
              } else setMessage('That file is not an Outagekit backup.');
            }}
          >
            <Icon name="upload" size={18} /> Restore a backup
          </button>
          <button
            type="button"
            className="button button-quiet button-danger"
            onClick={() => {
              if (window.confirm('Delete everything and start again with the example?')) {
                dispatch({ type: 'state/reset' });
                setMessage('Everything was reset.');
              }
            }}
          >
            <Icon name="trash" size={18} /> Start over
          </button>
        </div>
        {message && (
          <p className="callout" role="status">
            {message}
          </p>
        )}
      </Section>

      <Section id="open-source" title="Open source">
        <p>
          The app is free software under the GNU GPL v3. The runtime calculator and device catalog
          are a separate MIT-licensed library, <code>@outagekit/runtime</code>, so anyone can build
          on them. Corrections to the device catalog are very welcome.
        </p>
        <p>
          <a href={REPO} target="_blank" rel="noreferrer">
            Source code on GitHub
          </a>{' '}
          ·{' '}
          <a href={`${REPO}/issues/new/choose`} target="_blank" rel="noreferrer">
            Report a problem or a device figure
          </a>
        </p>
        <p className="version" data-testid="version">
          Version {VERSION_LABEL} · built {BUILD_DATE}
        </p>
      </Section>
    </div>
  );
}

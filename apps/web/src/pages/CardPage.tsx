import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/fields';
import { cardContent, type CardContent } from '../lib/card';
import { saveFile } from '../lib/files';
import { formatDate } from '../lib/format';
import { isNative } from '../lib/platform';
import { hrefFor } from '../lib/router';
import { APP_VERSION } from '../lib/version';
import { useStore } from '../state/store';

/** The same content as the PDF, laid out in HTML for preview and printing. */
export function CardPreview({ content }: { content: CardContent }) {
  return (
    <article className="fridge-card" aria-label="Fridge card preview" data-testid="fridge-card">
      <header className="fc-band">
        <h2>{content.title}</h2>
        {(content.personName || content.address) && (
          <p>{[content.personName, content.address].filter(Boolean).join(' · ')}</p>
        )}
      </header>
      {content.criticalLine && <p className="fc-critical">{content.criticalLine}</p>}
      {(content.medicalNote || content.phone) && (
        <p className="fc-note">
          {[content.medicalNote, content.phone ? `Phone: ${content.phone}` : '']
            .filter(Boolean)
            .join('  ·  ')}
        </p>
      )}
      <div className={`fc-stats ${content.runtimeMedical ? 'fc-stats-3' : ''}`}>
        <div>
          <span>Battery lasts about</span>
          <strong>{content.runtimeAll}</strong>
          <small>with everything on</small>
        </div>
        {content.runtimeMedical && (
          <div>
            <span>Medical equipment only</span>
            <strong>{content.runtimeMedical}</strong>
            <small>after switching off the rest</small>
          </div>
        )}
        <div>
          <span>When to leave</span>
          <strong>{content.leaveValue}</strong>
          <small>{content.leaveSub}</small>
        </div>
      </div>
      <p className="fc-source">{content.sourceLine}</p>
      <ol className="fc-steps">
        {content.steps.map((step) => (
          <li key={step.id} className={step.tone === 'urgent' ? 'fc-urgent' : undefined}>
            <h3>{step.title}</h3>
            {step.headline && <p className="fc-headline">{step.headline}</p>}
            <ul>
              {step.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {content.devices.length > 0 && (
        <section className="fc-devices">
          <h3>Equipment on the battery</h3>
          <table>
            <tbody>
              {content.devices.map((device, index) => (
                <tr key={`${device.name}-${index}`}>
                  <td>
                    {device.name}
                    {device.detail && <span> ({device.detail})</span>}
                  </td>
                  <td>{device.watts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {content.extraNotes && (
        <section className="fc-notes">
          <h3>Notes</h3>
          <p>{content.extraNotes}</p>
        </section>
      )}
      <footer>{content.footer}</footer>
    </article>
  );
}

export function CardPage() {
  const { state, dispatch, now } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = useMemo(() => cardContent(state, now, APP_VERSION), [state, now]);
  const missing: string[] = [];
  if (!state.profile.personName) missing.push('the person’s name');
  if (!state.profile.address) missing.push('the address');
  if (state.profile.destinations.length === 0) missing.push('where to go');
  if (state.profile.contacts.length === 0) missing.push('who to call');

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { buildCardPdf, cardFileName } = await import('../lib/pdf');
      const bytes = await buildCardPdf(content, state.settings.paper);
      await saveFile(cardFileName(state.profile.personName), bytes, 'application/pdf');
      dispatch({ type: 'card/updated' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not make the PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header no-print">
        <h1>Fridge card</h1>
        <p>
          One page, large type, in the order to act. Print it and put it on the fridge, and give a
          copy to whoever checks on you. Times on the card assume a full charge.
        </p>
      </header>

      {missing.length > 0 && (
        <p className="callout no-print">
          <Icon name="info" size={18} /> The card is missing {missing.join(', ')}.{' '}
          <a href={hrefFor('plan')}>Add plan details</a>.
        </p>
      )}

      <div className="card-actions no-print">
        <button
          type="button"
          className="button button-primary button-large"
          onClick={download}
          disabled={busy}
        >
          <Icon name={isNative() ? 'share' : 'download'} />{' '}
          {busy ? 'Making PDF…' : isNative() ? 'Share PDF' : 'Download PDF'}
        </button>
        {!isNative() && (
          <button
            type="button"
            className="button button-large"
            onClick={() => {
              dispatch({ type: 'card/updated' });
              window.print();
            }}
          >
            <Icon name="print" /> Print
          </button>
        )}
        <Segmented
          label="Paper"
          value={state.settings.paper}
          options={[
            { value: 'letter', label: 'Letter' },
            { value: 'a4', label: 'A4' },
          ]}
          onChange={(paper) => dispatch({ type: 'settings/update', patch: { paper } })}
        />
      </div>
      {error && (
        <p className="callout callout-danger no-print" role="alert">
          {error}
        </p>
      )}
      {state.cardUpdatedAt && (
        <p className="hint no-print">
          Last printed or downloaded {formatDate(state.cardUpdatedAt)}. Print a new one when your
          devices or battery change.
        </p>
      )}

      <div className={`card-sheet card-sheet-${state.settings.paper}`}>
        <CardPreview content={content} />
      </div>
    </div>
  );
}

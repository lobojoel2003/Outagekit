import { devices } from '@outagekit/runtime';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { deviceFromCatalog } from '../src/state/factories';
import { testState } from './helpers';

function summary() {
  return screen.getByTestId('runtime-summary').textContent ?? '';
}

describe('the app', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('shows the dial and the plan', () => {
    render(<App initialState={testState()} />);
    expect(summary()).toMatch(/^Your setup runs \d+ hours?/);
    expect(screen.getByTestId('dial')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^Your setup runs/),
    );
    const plan = screen.getByTestId('plan');
    expect(within(plan).getByText('Switch off first')).toBeInTheDocument();
    expect(within(plan).getByText('When to leave')).toBeInTheDocument();
  });

  it('moves the dial at once when a device is switched off', async () => {
    const user = userEvent.setup();
    render(<App initialState={testState()} />);
    const before = summary();
    await user.click(screen.getByRole('switch', { name: 'TV switched on' }));
    expect(summary()).not.toBe(before);
    expect(screen.getByRole('switch', { name: 'TV switched on' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('moves the dial when a setting changes', async () => {
    const user = userEvent.setup();
    const cpap = devices.find((d) => d.category === 'cpap' && d.settings.length > 1)!;
    const state = testState({ devices: [deviceFromCatalog(cpap)] });
    render(<App initialState={state} />);
    const before = summary();
    const lowest = [...cpap.settings].sort((a, b) => a.watts - b.watts)[0]!;
    await user.selectOptions(screen.getByLabelText('Setting'), lowest.id);
    expect(summary()).not.toBe(before);
  });

  it('adds a device from the catalog', async () => {
    const user = userEvent.setup();
    render(<App initialState={testState()} />);
    await user.click(screen.getByRole('button', { name: /Add device/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('searchbox'), 'fridge');
    const first = within(dialog)
      .getAllByRole('button')
      .find((b) => b.classList.contains('catalog-item'))!;
    await user.click(first);
    expect(screen.getAllByTestId('device')).toHaveLength(3);
  });

  it('adds a custom device', async () => {
    const user = userEvent.setup();
    render(<App initialState={testState()} />);
    await user.click(screen.getByRole('button', { name: /Add device/ }));
    await user.click(screen.getByRole('button', { name: 'Enter my own' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Name'), 'Suction pump');
    await user.click(screen.getByRole('button', { name: /Add Suction pump/ }));
    expect(screen.getByRole('heading', { name: 'Suction pump' })).toBeInTheDocument();
  });

  it('starts and shows an outage countdown', async () => {
    const user = userEvent.setup();
    render(<App initialState={testState()} />);
    await user.click(screen.getByRole('button', { name: /Power is out/ }));
    expect(summary()).toMatch(/left$/);
    expect(screen.getByText(/Power out since/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Power is back/ })).toBeInTheDocument();
  });

  it('shows the example banner and clears it', async () => {
    const user = userEvent.setup();
    render(<App initialState={{ ...testState(), isExample: true }} />);
    expect(screen.getByText(/This is an example setup/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start empty' }));
    expect(screen.queryByText(/This is an example setup/)).not.toBeInTheDocument();
    expect(summary()).toMatch(/Add your devices/);
  });

  it('renders every page', async () => {
    render(<App initialState={testState()} />);
    for (const [hash, heading] of [
      ['#/plan', 'Plan details'],
      ['#/card', 'Fridge card'],
      ['#/reminders', 'Keep it charged'],
      ['#/about', 'About Outagekit'],
    ] as const) {
      await act(async () => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByTestId('version')).toHaveTextContent(/Version/);
  });

  it('fills in plan details that reach the card', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/plan';
    render(<App initialState={testState()} />);
    await user.type(screen.getAllByLabelText('Name')[0]!, 'Rosa');
    await user.click(screen.getByRole('button', { name: /Add place/ }));
    await user.type(screen.getByLabelText('Place'), 'Ana house');
    await act(async () => {
      window.location.hash = '#/card';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const card = screen.getByTestId('fridge-card');
    expect(card).toHaveTextContent('Rosa');
    expect(card).toHaveTextContent('Ana house');
  });
});

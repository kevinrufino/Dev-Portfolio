import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';
import { SAVE_KEY, freshGame, target } from '../game/homeAlone';

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  window.scrollTo = jest.fn();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
const open = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <NotFound />
    </MemoryRouter>,
  );

test('reunion unlocks a new vacation with boosted earnings and empty traps', () => {
  const g = freshGame();
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      ...g,
      earned: target(g),
      supplies: 400,
      traps: [1, 0, 0, 0],
    }),
  );
  open();
  fireEvent.click(screen.getByRole('button', { name: /Another vacation/ }));
  expect(
    screen.getByRole('button', {
      name: 'Scavenge supplies, gain 1.25 per click',
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /Build Micro machines.*Owned 0/ })
      .disabled,
  ).toBe(true);
  expect(screen.queryByRole('button', { name: /Another vacation/ })).toBeNull();
});
test('a raid grants a bonus only once, then persists the cooldown on exit', () => {
  const g = { ...freshGame(), raidAt: 0 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(g));
  const view = open();
  const button = screen.getByRole('button', { name: 'Spring traps ↗' });
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  view.unmount();
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
  expect(saved.supplies).toBe(15);
  expect(saved.raidAt).toBeGreaterThan(Date.now());
});
test('reset requires confirmation and cancel preserves the current game', () => {
  open();
  fireEvent.click(
    screen.getByRole('button', { name: /Scavenge supplies, gain/ }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reset game' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText(/1 \/ 4,040 total supplies/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reset game' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, reset' }));
  expect(screen.getByText(/0 \/ 4,040 total supplies/)).toBeTruthy();
});

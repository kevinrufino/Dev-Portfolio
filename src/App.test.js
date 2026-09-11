import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * A smoke test, and two claims about the loader.
 *
 * The app mounts a lot of drawing — cursor field, pixel trail, physics canvas —
 * none of which jsdom implements. `setupTests.js` supplies inert stubs for the
 * observers, matchMedia, canvas and the Font Loading API so that mounting is
 * possible at all; these tests are about what the first paint says, not about
 * any of that.
 */

test('mounts without throwing, and lands on the loading gate', () => {
  render(<App />);
  // The gate is a real thing to assert on: until it hands off it covers the
  // page and blocks interaction, so its presence IS the initial state.
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test('the loading gate holds the page underneath still', () => {
  render(<App />);
  // The gate is a real interaction lock, not a decoration: it covers the page
  // and freezes its scroll until the name hands off to the physics canvas.
  // If this stops being true, a reader can scroll away mid-sequence and the
  // pile lands somewhere they are no longer looking.
  expect(document.body).toHaveStyle({ overflow: 'hidden' });
});

test('the loading percentage is readable, not just drawn', () => {
  render(<App />);
  // The digits on screen are a stack of aria-hidden columns — see
  // RollingNumber — so the figure a screen reader gets is a separate, single
  // string. That split is the point, and this is what guards it: the
  // percentage has to exist as text somewhere, or the loader is a silent
  // progress indicator.
  expect(screen.getByText(/^\d+%$/)).toBeInTheDocument();
});

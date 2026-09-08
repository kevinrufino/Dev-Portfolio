import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import AssetSlot from './AssetSlot.js';
import { MediaLightboxProvider } from './MediaLightbox.js';

// jsdom implements neither playback nor layout: every rect is zero, and
// play/pause throw "not implemented". The lift reads both, so they are stubbed
// here — what is under test is what opens, what closes, and where focus lands,
// not the animation itself.
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = jest.fn();
  window.matchMedia =
    window.matchMedia ||
    (query => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
});

const renderSlot = (props = {}) =>
  render(
    <MediaLightboxProvider>
      <AssetSlot src='/optimized/example.mp4' caption='A capture' {...props} />
    </MediaLightboxProvider>,
  );

test('a filled figure opens into the inspector and closes back out', async () => {
  renderSlot();

  const opener = screen.getByRole('button', {
    name: 'Open A capture full screen',
  });
  fireEvent.click(opener);

  const dialog = screen.getByRole('dialog', { name: 'A capture' });
  expect(dialog).toBeInTheDocument();
  expect(document.body).toHaveStyle('overflow: hidden');

  fireEvent.click(screen.getByRole('button', { name: /Close/ }));
  await act(() => new Promise(done => setTimeout(done, 500)));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  // The page scrolls again, and the reader is put back on the figure they
  // opened rather than at the top of the document.
  expect(document.body.style.overflow).toBe('');
  expect(opener).toHaveFocus();
});

test('Escape closes the inspector', async () => {
  renderSlot();

  fireEvent.click(
    screen.getByRole('button', { name: 'Open A capture full screen' }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  await act(() => new Promise(done => setTimeout(done, 500)));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an empty slot stays a caption, not a button', () => {
  render(
    <MediaLightboxProvider>
      <AssetSlot caption='Nothing here yet' />
    </MediaLightboxProvider>,
  );

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
});

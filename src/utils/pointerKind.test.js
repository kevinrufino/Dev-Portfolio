import { render } from '@testing-library/react';
import React from 'react';
import { hasFinePointer } from './pointerKind.js';
import PixelTrail from '../components/PixelTrail.js';

/**
 * The cursor effects are the largest thing on the page that a touch device can
 * never use. Three full-viewport canvases mount for the trail alone, and the
 * gravity registry re-measures every field on every scroll — all of it aiming a
 * cursor that is not there.
 */

const setPointer = fine => {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: query === '(pointer: fine)' ? fine : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
};

afterEach(() => jest.restoreAllMocks());

test('reads the same query the stylesheet uses to hide the native cursor', () => {
  setPointer(true);
  expect(hasFinePointer()).toBe(true);
  setPointer(false);
  expect(hasFinePointer()).toBe(false);
  expect(window.matchMedia).toHaveBeenCalledWith('(pointer: fine)');
});

test('assumes a cursor when it cannot ask', () => {
  // Server render, or a browser without matchMedia: the full experience is the
  // safer default, since the cost of being wrong is wasted work rather than a
  // missing interaction.
  const real = window.matchMedia;
  delete window.matchMedia;
  expect(hasFinePointer()).toBe(true);
  window.matchMedia = real;
});

test('the pixel trail draws nothing on a touch screen', () => {
  setPointer(false);
  const { container } = render(<PixelTrail zone='page' />);
  expect(container.querySelector('canvas')).toBeNull();
  expect(container.querySelector('.portfolio-pixel-trail')).toBeNull();
});

test('…and is unchanged where there is a cursor', () => {
  setPointer(true);
  const { container } = render(<PixelTrail zone='page' />);
  expect(container.querySelector('canvas')).not.toBeNull();
});

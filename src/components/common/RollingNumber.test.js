import React from 'react';
import { act, render, screen } from '@testing-library/react';
import RollingNumber from './RollingNumber.js';

const strip = (container, at) =>
  container.querySelectorAll('.roll__strip')[at].getAttribute('style');
const columns = container => container.querySelectorAll('.roll__col');

beforeEach(() => {
  window.matchMedia = jest.fn(() => ({ matches: false }));
});

test('the number itself is what gets read; the columns are decoration', () => {
  render(<RollingNumber value={63} suffix='%' />);
  // One string, once — not eleven digits per place.
  expect(screen.getByText('63%')).toBeInTheDocument();
  expect(document.querySelector('.roll__field')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});

test('a field is as wide as the number it is counting to', () => {
  // Two places for 63, from the first frame — so the tile does not reflow as
  // the figure climbs from one digit to two.
  const { container } = render(<RollingNumber value={63} countOnView />);
  expect(columns(container)).toHaveLength(2);
});

test('counts up on reveal, and prints no leading zero on the way', () => {
  let observed;
  const disconnect = jest.fn();
  window.IntersectionObserver = jest.fn(cb => ({
    observe: () => {
      observed = cb;
    },
    disconnect,
  }));
  const frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(fn => frames.push(fn));

  const { container } = render(<RollingNumber value={63} countOnView />);
  // The markup carries the real figure before anything animates, which is what
  // shows under reduced motion, without an observer, or with JS off.
  expect(screen.getByText('63')).toBeInTheDocument();
  expect(columns(container)).toHaveLength(2);

  act(() => observed([{ isIntersecting: true }]));
  // A few ms in, the count is somewhere in single figures — and the tens
  // column, which is only there to hold the width, is not showing a zero.
  act(() => frames.pop()(performance.now() + 20));
  expect(columns(container)[0].style.opacity).toBe('0');
  expect(columns(container)[1].style.opacity).toBe('1');

  // Well past the end, it is sitting on the figure it started as.
  act(() => frames.pop()(performance.now() + 5000));
  expect(strip(container, 0)).toContain('* -6)');
  expect(strip(container, 1)).toContain('* -3)');
  expect(columns(container)[0].style.opacity).toBe('1');
});

test('a place turns only during its own carry', () => {
  // 40 → the tens digit is on 4 and the units digit is home.
  const { container } = render(<RollingNumber value={40} />);
  expect(strip(container, 0)).toContain('* -4)');
  // Negative zero prints as zero — the column has not moved.
  expect(strip(container, 1)).toContain('* 0)');
});

test('the units digit turns continuously between whole numbers', () => {
  // Rendered as a whole number counting toward 12, caught at 7.5.
  const { container } = render(<RollingNumber value={7.5} />);
  // Mid-turn between seven and eight, which is what makes it read as rolling
  // rather than as text being rewritten.
  expect(strip(container, 0)).toContain('* -7.5)');
});

test('nine wraps forward into the duplicate zero rather than snapping back', () => {
  const { container } = render(<RollingNumber value={99.99} />);
  const strips = container.querySelectorAll('.roll__strip');
  // Eleven digits: 0–9, then 0 again — so a column at position 10 shows a zero
  // that is BELOW the nine it just left.
  expect(strips[1].querySelectorAll('.roll__d')).toHaveLength(11);
  const units = Number(strip(container, 1).match(/\* (-[\d.]+)\)/)[1]);
  expect(units).toBeLessThan(-9.9);
  expect(units).toBeGreaterThanOrEqual(-10);
});

test('under reduced motion the digits snap instead of turning', () => {
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const { container } = render(<RollingNumber value={7.5} />);
  expect(strip(container, 0)).toContain('* -8)');
});

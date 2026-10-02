import { FRAME_ORDER, frameSubscriberCount, onFrame } from './frameLoop.js';

/**
 * The loop is driven by hand here: requestAnimationFrame is replaced with a
 * queue, and `frame(t)` runs whatever is queued at timestamp `t`. That makes
 * the claims below exact rather than timing-dependent.
 */
let queue = [];
let nextId = 1;
const frame = t => {
  const run = queue;
  queue = [];
  for (const { cb } of run) cb(t);
};

let leave = [];
const subscribe = (fn, options) => {
  const off = onFrame(fn, options);
  leave.push(off);
  return off;
};

beforeEach(() => {
  queue = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    const id = nextId++;
    queue.push({ id, cb });
    return id;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    queue = queue.filter(entry => entry.id !== id);
  });
});

afterEach(() => {
  leave.forEach(off => off());
  leave = [];
  jest.restoreAllMocks();
});

test('runs every subscriber on one requestAnimationFrame chain', () => {
  const a = jest.fn();
  const b = jest.fn();
  subscribe(a);
  subscribe(b);
  // Two subscribers, one scheduled frame — that is the whole point.
  expect(queue).toHaveLength(1);
  frame(16);
  expect(a).toHaveBeenCalledWith(16, 0);
  expect(b).toHaveBeenCalledWith(16, 0);
  expect(queue).toHaveLength(1);
});

test('runs subscribers in frame order, not subscription order', () => {
  const calls = [];
  subscribe(() => calls.push('draw'), { order: FRAME_ORDER.draw });
  subscribe(() => calls.push('input'), { order: FRAME_ORDER.input });
  subscribe(() => calls.push('simulate'), { order: FRAME_ORDER.simulate });
  frame(16);
  expect(calls).toEqual(['input', 'simulate', 'draw']);
});

test('honours an interval, with a millisecond of slack', () => {
  const fn = jest.fn();
  subscribe(fn, { interval: 31 });
  frame(0);
  frame(16.7);
  frame(33.4);
  frame(50.1);
  frame(66.8);
  // A 31ms budget on a 60Hz display lands on every other frame.
  expect(fn.mock.calls.map(([t]) => t)).toEqual([0, 33.4, 66.8]);
  expect(fn.mock.calls[1][1]).toBeCloseTo(33.4);
});

test('stops scheduling once the last subscriber leaves', () => {
  const off = subscribe(jest.fn());
  expect(queue).toHaveLength(1);
  off();
  expect(queue).toHaveLength(0);
  expect(frameSubscriberCount()).toBe(0);
  // Leaving twice is harmless.
  off();
  expect(frameSubscriberCount()).toBe(0);
});

test('a subscriber can leave from inside its own callback', () => {
  const after = jest.fn();
  let off;
  const once = jest.fn(() => off());
  off = subscribe(once);
  subscribe(after);
  frame(16);
  frame(32);
  expect(once).toHaveBeenCalledTimes(1);
  expect(after).toHaveBeenCalledTimes(2);
});

test('one failing subscriber does not stop the others', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const fine = jest.fn();
  subscribe(() => {
    throw new Error('boom');
  });
  subscribe(fine);
  frame(16);
  frame(32);
  expect(fine).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalled();
});

import silenceResizeObserverNoise from './devOverlayNoise.js';

/**
 * The risky half of this module is not what it does in development — it is that
 * it must do nothing at all anywhere else. A ResizeObserver whose callbacks run
 * a frame late is a fine trade against a red overlay while developing, and not a
 * trade worth making in a build real people load.
 */

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  fire(entries) {
    this.callback(entries, this);
  }
}

const withNodeEnv = (value, run) => {
  const previous = process.env.NODE_ENV;
  // NODE_ENV is read-only under some setups; define it back explicitly.
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: previous,
      configurable: true,
    });
  }
};

beforeEach(() => {
  window.ResizeObserver = FakeResizeObserver;
});

test('leaves production alone', () => {
  withNodeEnv('production', () => {
    silenceResizeObserverNoise();
    expect(window.ResizeObserver).toBe(FakeResizeObserver);
  });
});

test('leaves the test environment alone', () => {
  silenceResizeObserverNoise();
  expect(window.ResizeObserver).toBe(FakeResizeObserver);
});

test('defers callbacks by a frame in development', () => {
  const frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(fn => frames.push(fn));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  withNodeEnv('development', () => {
    silenceResizeObserverNoise();
    expect(window.ResizeObserver).not.toBe(FakeResizeObserver);

    const seen = [];
    const observer = new window.ResizeObserver(entries => seen.push(entries));
    observer.fire(['a']);

    // Nothing yet — that is the whole point: the observation cycle gets to
    // finish before the callback is allowed to touch layout.
    expect(seen).toEqual([]);
    frames.forEach(fn => fn());
    expect(seen).toEqual([['a']]);
  });
  jest.restoreAllMocks();
});

test('does not wrap twice', () => {
  withNodeEnv('development', () => {
    silenceResizeObserverNoise();
    const once = window.ResizeObserver;
    silenceResizeObserverNoise();
    expect(window.ResizeObserver).toBe(once);
  });
});

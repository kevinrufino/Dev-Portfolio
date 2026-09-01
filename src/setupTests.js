// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

class TestIntersectionObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

window.IntersectionObserver = TestIntersectionObserver;
global.IntersectionObserver = TestIntersectionObserver;
window.scrollTo = jest.fn();

window.matchMedia = query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
});

HTMLCanvasElement.prototype.getContext = () => ({
  arc() {},
  beginPath() {},
  clearRect() {},
  drawImage() {},
  fill() {},
  fillRect() {},
  restore() {},
  rotate() {},
  roundRect() {},
  save() {},
  setTransform() {},
  translate() {},
});

Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { ready: Promise.resolve() },
});

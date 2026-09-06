import { useEffect, useState } from 'react';

/**
 * Types a list of strings, one character at a time, then deletes and moves on.
 *
 * Replaces the `typewriter-effect` package, which mounts its own DOM and
 * animation loop for what is a `setTimeout` and a substring. The timings match
 * the design: characters land at 78ms, delete at 50ms (deleting reads as a
 * correction, so it wants to be faster than typing), the finished word holds
 * for 1400ms, and there is a 320ms beat on empty before the next one starts.
 *
 * Under `prefers-reduced-motion` the first string is returned in full and no
 * timer ever runs.
 *
 * @param {string[]} strings - phrases to cycle.
 * @returns {string} the current partial phrase.
 */
const TYPE_MS = 78;
const DELETE_MS = 50;
const HOLD_MS = 1400;
const BETWEEN_MS = 320;

export default function useTypewriter(strings) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!strings.length) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTyped(strings[0]);
      return undefined;
    }

    let timer = 0;
    let word = 0;
    let chars = 0;
    let deleting = false;

    const step = () => {
      const current = strings[word];

      if (deleting) {
        chars -= 1;
        if (chars <= 0) {
          deleting = false;
          word = (word + 1) % strings.length;
          timer = window.setTimeout(step, BETWEEN_MS);
        } else {
          timer = window.setTimeout(step, DELETE_MS);
        }
      } else {
        chars += 1;
        if (chars >= current.length) {
          deleting = true;
          timer = window.setTimeout(step, HOLD_MS);
        } else {
          timer = window.setTimeout(step, TYPE_MS);
        }
      }

      setTyped(current.slice(0, Math.max(0, chars)));
    };

    timer = window.setTimeout(step, 900);
    return () => window.clearTimeout(timer);
    // `strings` is expected to be a module-scope constant, so its identity is
    // stable and a re-render never restarts the animation. Building the array
    // inline at the call site would retype from the top on every render.
  }, [strings]);

  return typed;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { flushSync } from 'react-dom';
import { Router } from 'react-router-dom';
import { createBrowserHistory } from '@remix-run/router';
import {
  runRouteTransition,
  warmRouteTransition,
} from '../utils/routeTransition.js';

/**
 * BrowserRouter, with every change of page run under the route curtain.
 *
 * The same history BrowserRouter builds, listened to the same way — the one
 * difference is what happens when the pathname changes: the state update is
 * handed to `runRouteTransition`, which starts a View Transition and applies
 * the new route inside it (`flushSync`, because the browser captures the
 * incoming page the moment the update returns).
 *
 * Doing it at the history listener rather than at the links is what covers
 * every way of changing page — a link, `navigate()`, and the browser's own
 * back and forward buttons — with one code path. framer-motion's
 * AnimatePresence did this before by holding the outgoing route mounted until
 * a canvas had covered it; the browser now holds a snapshot instead, so the
 * outgoing page can unmount at once.
 *
 * Same-path updates (the homepage clearing its `scrollTo` state, say) are
 * applied directly: there is no page change for a curtain to cover.
 */
const ViewTransitionRouter = ({ children }) => {
  const historyRef = useRef(null);
  if (historyRef.current == null) {
    historyRef.current = createBrowserHistory({ v5Compat: true });
  }
  const history = historyRef.current;
  const [state, setState] = useState({
    action: history.action,
    location: history.location,
  });

  useLayoutEffect(() => {
    let path = history.location.pathname;
    return history.listen(({ action, location }) => {
      const next = { action, location };
      if (location.pathname === path) {
        setState(next);
        return;
      }
      path = location.pathname;
      runRouteTransition(() => flushSync(() => setState(next)));
    });
  }, [history]);

  // The masks are a few milliseconds of work; do them while idle so the first
  // navigation does not pay for them.
  useEffect(() => warmRouteTransition(), []);

  return (
    <Router
      location={state.location}
      navigationType={state.action}
      navigator={history}
    >
      {children}
    </Router>
  );
};

ViewTransitionRouter.propTypes = {
  children: PropTypes.node,
};

export default ViewTransitionRouter;

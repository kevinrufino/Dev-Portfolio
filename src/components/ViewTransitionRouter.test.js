import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import ViewTransitionRouter from './ViewTransitionRouter.js';

/**
 * What the router promises: a change of page runs inside a View Transition
 * when the browser has one, a same-page update never does, and without the
 * API the route still changes.
 */
let navigate;
const Grab = () => {
  navigate = useNavigate();
  return null;
};

const app = () => (
  <ViewTransitionRouter>
    <Grab />
    <Routes>
      <Route path='/' element={<p>home page</p>} />
      <Route path='/projects/:slug' element={<p>project page</p>} />
    </Routes>
  </ViewTransitionRouter>
);

// jsdom has no canvas encoder; the masks are a real browser's business.
beforeAll(() => {
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/png;base64,');
});

afterEach(() => {
  delete document.startViewTransition;
  window.history.replaceState(null, '', '/');
});

test('runs a change of page inside startViewTransition', async () => {
  const start = jest.fn(update => {
    update();
    return { finished: Promise.resolve() };
  });
  document.startViewTransition = start;

  render(app());
  expect(screen.getByText('home page')).toBeInTheDocument();

  await act(async () => navigate('/projects/example'));
  expect(start).toHaveBeenCalledTimes(1);
  expect(screen.getByText('project page')).toBeInTheDocument();
  // Only for the length of the sweep.
  expect(document.documentElement).not.toHaveAttribute('data-route-curtain');
});

test('does not start a transition for a same-page update', async () => {
  const start = jest.fn(update => {
    update();
    return { finished: Promise.resolve() };
  });
  document.startViewTransition = start;

  render(app());
  await act(async () => navigate('/', { replace: true, state: { a: 1 } }));
  expect(start).not.toHaveBeenCalled();
});

test('still changes page where View Transitions are unsupported', async () => {
  render(app());
  await act(async () => navigate('/projects/example'));
  expect(screen.getByText('project page')).toBeInTheDocument();
});

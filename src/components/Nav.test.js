import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './Nav.js';

test('replaces the section links with a back control on project pages', () => {
  render(
    <MemoryRouter initialEntries={['/projects/example-project']}>
      <NavBar setCursor={jest.fn()} />
    </MemoryRouter>,
  );

  // A button rather than a link, deliberately: an `/#projects` href left the
  // section in the address bar, so reloading after coming back dropped the
  // reader into the middle of the page. The control navigates and scrolls
  // without writing a hash. See the note in Nav.js.
  const back = screen.getByRole('button', { name: 'Back to projects' });
  expect(back).toBeInTheDocument();
  expect(back).not.toHaveAttribute('href');

  // …and the section links it replaces are gone.
  expect(screen.queryByRole('link', { name: 'home' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'work' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'connect' }),
  ).not.toBeInTheDocument();
});

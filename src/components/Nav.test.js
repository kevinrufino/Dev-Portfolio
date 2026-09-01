import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './Nav.js';

test('replaces the section links with a back icon on project pages', () => {
  render(
    <MemoryRouter initialEntries={['/projects/example-project']}>
      <NavBar setCursor={jest.fn()} />
    </MemoryRouter>,
  );

  const backLink = screen.getByRole('link', { name: 'Back to projects' });

  expect(backLink).toHaveAttribute('href', '/#projects');
  expect(screen.queryByRole('link', { name: 'home' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'work' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'connect' }),
  ).not.toBeInTheDocument();
});

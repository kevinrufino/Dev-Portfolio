import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders portfolio application', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /kevin rufino/i })).toBeInTheDocument();
});

test('renders boot screen initially', () => {
  render(<App />);
  expect(screen.getByText(/starting kevin os/i)).toBeInTheDocument();
});

test('renders all selected projects', () => {
  render(<App />);
  expect(screen.getByRole('list', { name: /select a project/i }).children).toHaveLength(6);
});

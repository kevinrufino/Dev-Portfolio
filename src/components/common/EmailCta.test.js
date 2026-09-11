import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailCta, { EMAIL } from './EmailCta.js';

const cta = () => screen.getByRole('button');

afterEach(() => {
  delete navigator.clipboard;
});

test('copies the address and says so in place of the label', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });

  render(<EmailCta />);
  // Both states are in the markup from the start — they share a box and swap
  // through it — so the confirmation is present and hidden, not absent.
  expect(cta()).toHaveTextContent('Email');
  expect(cta()).toHaveTextContent('Email copied');
  expect(cta().className).not.toMatch(/is-copied/);

  await userEvent.click(cta());

  expect(writeText).toHaveBeenCalledWith(EMAIL);
  await waitFor(() => expect(cta().className).toMatch(/is-copied/));
  expect(screen.getByRole('status')).toHaveTextContent(EMAIL);
});

test('shows the address rather than launching a mail client when it cannot copy', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
  });
  // jsdom has no execCommand either, so both paths fail — which is the case
  // this is about.
  const before = window.location.href;

  render(<EmailCta />);
  await userEvent.click(cta());

  await waitFor(() => expect(cta()).toHaveTextContent(EMAIL));
  expect(cta().className).not.toMatch(/is-copied/);
  // The whole point of the control is that it does not do this.
  expect(window.location.href).toBe(before);
});

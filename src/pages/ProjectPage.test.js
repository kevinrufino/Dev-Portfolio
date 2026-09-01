import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage.js';

jest.mock('../components/CaseStudy/HalftoneField.js', () => ({
  __esModule: true,
  default: ({ label }) => <div data-testid='halftone-field'>{label}</div>,
}));

const renderProject = slug =>
  render(
    <MemoryRouter initialEntries={[`/projects/${slug}`]}>
      <Routes>
        <Route path='/projects/:slug' element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );

test('renders the full Moodie case study with interactive halftone fields', () => {
  renderProject('moodie');

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: /recommendation engine trained on one person/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId('halftone-field')).toHaveLength(2);
  expect(
    screen.getByText('Three decisions the rest of the build hangs on.'),
  ).toBeInTheDocument();
});

test('renders other projects with the concise showcase variant', () => {
  renderProject('max-s-lab');

  expect(
    screen.getByRole('heading', { level: 1, name: "Max's Lab" }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('halftone-field')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Project artifacts')).toBeInTheDocument();
});

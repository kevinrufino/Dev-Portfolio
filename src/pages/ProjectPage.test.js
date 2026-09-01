import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage.js';

jest.mock('../components/CaseStudy/HalftoneField.js', () => ({
  __esModule: true,
  default: ({ label }) => <div data-testid='halftone-field'>{label}</div>,
}));

const renderProject = (slug, query = '') =>
  render(
    <MemoryRouter initialEntries={[`/projects/${slug}${query}`]}>
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

test('renders the original pixel case-study direction', () => {
  const { container } = renderProject('moodie', '?style=original');

  expect(container.firstChild).toHaveAttribute(
    'data-design-direction',
    'original',
  );
  expect(screen.getAllByTestId('halftone-field')).toHaveLength(1);
  expect(screen.getByText('Drag to explore the graph')).toBeInTheDocument();
});

test('renders the original pixel showcase direction', () => {
  const { container } = renderProject('max-s-lab', '?style=original');

  expect(container.firstChild).toHaveClass('case-study-page--original');
  expect(screen.getByLabelText('Project artifacts')).toBeInTheDocument();
  expect(screen.queryByTestId('halftone-field')).not.toBeInTheDocument();
});

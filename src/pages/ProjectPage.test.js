import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage.js';

jest.mock('../constants.js', () => ({
  ProjectsData: [{ title: 'Alpha' }, { title: 'Beta' }],
}));
jest.mock('../components/Works/worksData.js', () => ({
  archiveFor: title => ({ title, client: 'Client' }),
  WORKS: { work: [{ title: 'Alpha' }, { title: 'Beta' }], personal: [] },
}));
// The site-wide hold, off by default here so the existing tests exercise a
// page with a body. `mock`-prefixed so jest lets the factory close over it.
let mockNotice = { enabled: false, text: 'More coming soon.' };
jest.mock('../content/siteSettings.js', () => ({
  // A getter, so the factory — which jest hoists above this file's own
  // initialisation — reads the object at render time rather than at mock time.
  get PROJECT_NOTICE() {
    return mockNotice;
  },
  DEFAULT_PROJECT_NOTICE: 'More coming soon.',
}));
jest.mock('../components/Project/projectStories.js', () => ({
  RETIRED_TITLES: new Set(),
  PROJECT_STORIES: {
    Alpha: { blocks: [{ title: 'Introduction' }, { title: 'Reflection' }] },
    Beta: { blocks: [{ title: 'Beta introduction' }] },
  },
}));
jest.mock('../hooks/useCursorFx.js', () => () => () => {});
jest.mock('../hooks/useGooFollower.js', () => () => ({
  groupRef: { current: null },
  followerRef: { current: null },
  setItemRef: () => () => {},
  rects: [],
}));
jest.mock('../components/common/GooPills.js', () => () => null);
jest.mock('../components/Project/AssetSlot.js', () => () => null);
jest.mock('../components/Project/MediaLightbox.js', () => ({
  MediaLightboxProvider: ({ children }) => children,
}));
jest.mock('../components/Project/ProjectBlocks.js', () => ({ block, id }) => (
  <section data-sec='' id={id}>
    {block.title}
  </section>
));

let frames;
beforeEach(() => {
  mockNotice = { enabled: false, text: 'More coming soon.' };
  frames = new Map();
  let id = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => {
    frames.set(++id, fn);
    return id;
  });
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(id => frames.delete(id));
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.matchMedia = jest.fn(() => ({ matches: true }));
  HTMLElement.prototype.scrollTo = jest.fn();
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(() => ({
      top: 1000,
      left: 0,
      width: 100,
      height: 100,
    }));
});
afterEach(() => jest.restoreAllMocks());

const openProject = () =>
  render(
    <MemoryRouter initialEntries={['/projects/alpha']}>
      <Routes>
        <Route path='/projects/:slug' element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );

test('changing the active chapter does not scroll the document back to the top', () => {
  const { container } = openProject();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  window.scrollTo.mockClear();
  container.querySelectorAll('[data-sec]').forEach(el => {
    el.getBoundingClientRect = () => ({ top: -100 });
  });
  act(() => {
    fireEvent.scroll(window);
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(fn => fn(16));
  });
  expect(screen.getByRole('link', { name: /02 Reflection/ })).toHaveStyle({
    borderColor: '#F1F43B',
  });
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test('hovering page navigation preserves the reading position', () => {
  openProject();
  window.scrollTo.mockClear();
  fireEvent.mouseEnter(screen.getByRole('button', { name: /selected work/ }));
  fireEvent.mouseLeave(screen.getByRole('button', { name: /selected work/ }));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test('navigating to another project still starts at the top', () => {
  openProject();
  window.scrollTo.mockClear();
  fireEvent.click(screen.getByRole('link', { name: /Beta/ }));
  expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  expect(document.title).toBe('Beta — Kevin Rufino');
});

test('the site notice stands in for the case study, and the footer stays', () => {
  mockNotice = { enabled: true, text: 'More coming soon.' };
  openProject();
  expect(
    screen.getByRole('heading', { name: 'More coming soon.' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /01 Introduction/ })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Beta/ })).toBeInTheDocument();
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/layout/AppShell';
import { AppRoutes } from '../../src/app/routes';
import { useAppStore } from '../../src/store/useAppStore';

const ROUTE_CASES = [
  { path: '/', heading: 'Welcome to Tick-Tock' },
  { path: '/learn', heading: 'Learn the Clock' },
  { path: '/explore', heading: 'Interactive Clock' },
  { path: '/exercise', heading: 'Clock Exercises' },
  { path: '/challenge', heading: 'Clock Challenge' },
  { path: '/progress', heading: 'Your Progress' },
  { path: '/parent', heading: 'Parent & Teacher View' },
] as const;

describe('Phase 0 Routing & Shell', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  it.each(ROUTE_CASES)('renders $path with expected screen heading', ({ path, heading }) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('redirects unknown paths to Home', () => {
    render(
      <MemoryRouter initialEntries={['/nonexistent-route']}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Welcome to Tick-Tock' })).toBeInTheDocument();
  });
});


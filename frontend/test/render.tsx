import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

// Single place to wrap components under test in app-wide providers.
//
// The app currently ships no React Context providers (verified: zero
// createContext call sites), so this is a thin passthrough today. When a
// provider is added (theme, auth, query client, …), wire it in here and every
// test picks it up for free.
function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Providers, ...options });
}

// Re-export the Testing Library surface so tests import from one place.
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

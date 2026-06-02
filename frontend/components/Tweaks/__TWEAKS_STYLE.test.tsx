import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import __TWEAKS_STYLE from './__TWEAKS_STYLE';

test('exports a non-empty CSS string with the panel selector', () => {
  expect(typeof __TWEAKS_STYLE).toBe('string');
  expect(__TWEAKS_STYLE).toContain('.twk-panel');
});

test('can be rendered into a <style> tag', () => {
  const { container } = renderWithProviders(<style>{__TWEAKS_STYLE}</style>);
  const style = container.querySelector('style');
  expect(style).not.toBeNull();
  expect(style?.textContent).toContain('.twk-toggle');
});

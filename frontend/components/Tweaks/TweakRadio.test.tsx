import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakRadio } from './TweakRadio';
import type { TweakOption } from './types';

// Short labels with a fitting column count render as inline segments.
test('renders a segmented control for short-label options', () => {
  renderWithProviders(
    <TweakRadio
      label="Align"
      value="left"
      options={['left', 'right']}
      onChange={() => {}}
    />,
  );
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(2);
  expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  expect(radios[1]).toHaveAttribute('aria-checked', 'false');
});

test('renders object options by their label', () => {
  const options: TweakOption[] = [
    { value: 'l', label: 'Lt' },
    { value: 'r', label: 'Rt' },
  ];
  renderWithProviders(
    <TweakRadio label="Side" value="l" options={options} onChange={() => {}} />,
  );
  expect(screen.getByRole('radio', { name: 'Lt' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Rt' })).toBeInTheDocument();
});

test('pointer-down on a segment selects the option under the cursor', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakRadio
      label="Align"
      value="left"
      options={['left', 'right']}
      onChange={onChange}
    />,
  );
  const track = screen.getByRole('radiogroup');
  // jsdom returns a zero-size rect; segAt clamps to the first option, which
  // already equals the value, so no change fires. Drive a far-right point to
  // exercise the handler without asserting a specific segment.
  track.getBoundingClientRect = () =>
    ({ left: 0, width: 200, top: 0, right: 200, bottom: 20, height: 20, x: 0, y: 0 }) as DOMRect;
  fireEvent.pointerDown(track, { clientX: 180 });
  expect(onChange).toHaveBeenCalledWith('right');
});

// Labels too long for the segment column budget fall through to a <select>.
test('falls back to a select when labels are too long to fit as segments', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakRadio
      label="Mode"
      value="alpha"
      options={['this-label-is-way-too-long-to-fit', 'beta']}
      onChange={onChange}
    />,
  );
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'beta' } });
  expect(onChange).toHaveBeenCalledWith('beta');
});

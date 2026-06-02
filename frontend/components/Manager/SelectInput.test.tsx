import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import SelectInput from './SelectInput';

// SelectInput is a thin styled <select> wrapper: it forwards value, onChange and
// children, and merges any extra style overrides on top of the shared input style.

test('renders the option children', () => {
  renderWithProviders(
    <SelectInput value="a">
      <option value="a">Alpha</option>
      <option value="b">Beta</option>
    </SelectInput>,
  );
  expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
});

test('reflects the controlled value', () => {
  renderWithProviders(
    <SelectInput value="b" onChange={vi.fn()}>
      <option value="a">Alpha</option>
      <option value="b">Beta</option>
    </SelectInput>,
  );
  expect(screen.getByRole('combobox')).toHaveValue('b');
});

test('fires onChange when the selection changes', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <SelectInput value="a" onChange={onChange}>
      <option value="a">Alpha</option>
      <option value="b">Beta</option>
    </SelectInput>,
  );
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('applies style overrides on top of the base style', () => {
  renderWithProviders(
    <SelectInput value="a" style={{ width: '50px' }}>
      <option value="a">Alpha</option>
    </SelectInput>,
  );
  expect(screen.getByRole('combobox')).toHaveStyle({ width: '50px' });
});

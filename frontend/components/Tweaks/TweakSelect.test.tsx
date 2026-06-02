import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakSelect } from './TweakSelect';

test('renders string options as <option> elements', () => {
  renderWithProviders(
    <TweakSelect label="Mode" value="a" options={['a', 'b', 'c']} onChange={() => {}} />,
  );
  expect(screen.getByText('Mode')).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('a');
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

test('renders object options using value/label', () => {
  renderWithProviders(
    <TweakSelect
      label="Mode"
      value="x"
      options={[
        { value: 'x', label: 'Ex' },
        { value: 'y', label: 'Why' },
      ]}
      onChange={() => {}}
    />,
  );
  expect(screen.getByRole('option', { name: 'Ex' })).toHaveValue('x');
  expect(screen.getByRole('option', { name: 'Why' })).toHaveValue('y');
});

test('emits the selected value on change', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakSelect label="Mode" value="a" options={['a', 'b']} onChange={onChange} />,
  );
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
  expect(onChange).toHaveBeenCalledWith('b');
});

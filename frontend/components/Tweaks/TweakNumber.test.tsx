import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakNumber } from './TweakNumber';

test('renders the label and current value', () => {
  renderWithProviders(<TweakNumber label="Count" value={5} onChange={() => {}} />);
  expect(screen.getByText('Count')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveValue(5);
});

test('renders the unit when supplied', () => {
  renderWithProviders(<TweakNumber label="Count" value={5} unit="ms" onChange={() => {}} />);
  expect(screen.getByText('ms')).toBeInTheDocument();
});

test('emits the numeric value on change', () => {
  const onChange = vi.fn();
  renderWithProviders(<TweakNumber label="Count" value={5} onChange={onChange} />);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });
  expect(onChange).toHaveBeenCalledWith(8);
});

test('clamps below the minimum', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakNumber label="Count" value={5} min={0} max={10} onChange={onChange} />,
  );
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-3' } });
  expect(onChange).toHaveBeenCalledWith(0);
});

test('clamps above the maximum', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakNumber label="Count" value={5} min={0} max={10} onChange={onChange} />,
  );
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
  expect(onChange).toHaveBeenCalledWith(10);
});

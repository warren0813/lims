import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakSlider } from './TweakSlider';

test('renders the label and the value with its unit', () => {
  renderWithProviders(
    <TweakSlider label="Size" value={42} unit="px" onChange={() => {}} />,
  );
  expect(screen.getByText('Size')).toBeInTheDocument();
  expect(screen.getByText('42px')).toBeInTheDocument();
});

test('renders the value without a unit by default', () => {
  renderWithProviders(<TweakSlider label="Size" value={7} onChange={() => {}} />);
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('wires min/max/step onto the range input', () => {
  renderWithProviders(
    <TweakSlider label="Size" value={5} min={1} max={9} step={2} onChange={() => {}} />,
  );
  const slider = screen.getByRole('slider');
  expect(slider).toHaveAttribute('min', '1');
  expect(slider).toHaveAttribute('max', '9');
  expect(slider).toHaveAttribute('step', '2');
});

test('emits a numeric value on change', () => {
  const onChange = vi.fn();
  renderWithProviders(<TweakSlider label="Size" value={5} onChange={onChange} />);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
  expect(onChange).toHaveBeenCalledWith(8);
});

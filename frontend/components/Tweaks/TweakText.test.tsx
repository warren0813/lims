import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakText } from './TweakText';

test('renders the label and current value', () => {
  renderWithProviders(<TweakText label="Name" value="hello" onChange={() => {}} />);
  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('hello');
});

test('passes the placeholder through to the input', () => {
  renderWithProviders(
    <TweakText label="Name" value="" placeholder="Type here" onChange={() => {}} />,
  );
  expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
});

test('emits the new value on change', () => {
  const onChange = vi.fn();
  renderWithProviders(<TweakText label="Name" value="a" onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
  expect(onChange).toHaveBeenCalledWith('abc');
});

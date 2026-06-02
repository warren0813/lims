import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakColor } from './TweakColor';

test('renders a native color swatch when no options are given', () => {
  const { container } = renderWithProviders(
    <TweakColor label="Bg" value="#112233" onChange={() => {}} />,
  );
  expect(screen.getByText('Bg')).toBeInTheDocument();
  const swatch = container.querySelector('input[type="color"]');
  expect(swatch).not.toBeNull();
  expect(swatch).toHaveValue('#112233');
});

test('the native swatch emits the picked value', () => {
  const onChange = vi.fn();
  const { container } = renderWithProviders(
    <TweakColor label="Bg" value="#112233" onChange={onChange} />,
  );
  const swatch = container.querySelector('input[type="color"]') as HTMLInputElement;
  fireEvent.change(swatch, { target: { value: '#445566' } });
  expect(onChange).toHaveBeenCalledWith('#445566');
});

test('renders one chip per option when options are supplied', () => {
  renderWithProviders(
    <TweakColor
      label="Palette"
      value="#ffffff"
      options={['#ffffff', '#000000', '#ff0000']}
      onChange={() => {}}
    />,
  );
  expect(screen.getAllByRole('radio')).toHaveLength(3);
});

test('marks the matching option as checked', () => {
  renderWithProviders(
    <TweakColor
      label="Palette"
      value="#000000"
      options={['#ffffff', '#000000']}
      onChange={() => {}}
    />,
  );
  const chips = screen.getAllByRole('radio');
  expect(chips[0]).toHaveAttribute('aria-checked', 'false');
  expect(chips[1]).toHaveAttribute('aria-checked', 'true');
  expect(chips[1]).toHaveAttribute('data-on', '1');
});

test('clicking a chip emits its option value', () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TweakColor
      label="Palette"
      value="#ffffff"
      options={['#ffffff', '#000000']}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getAllByRole('radio')[1]);
  expect(onChange).toHaveBeenCalledWith('#000000');
});

test('supports multi-color (array) options', () => {
  const onChange = vi.fn();
  const palette: string[] = ['#f4a8bf', '#bbb7e8', '#6c67b8'];
  renderWithProviders(
    <TweakColor
      label="Gradient"
      value="#ffffff"
      options={[palette]}
      onChange={onChange}
    />,
  );
  const chip = screen.getByRole('radio');
  // aria-label joins the colors so the supplementary swatches are described.
  expect(chip).toHaveAttribute('aria-label', palette.join(', '));
  fireEvent.click(chip);
  expect(onChange).toHaveBeenCalledWith(palette);
});

import { test, expect } from 'vitest';
import { slugForExperimentName } from './slugForExperimentName';

test('returns null for empty input', () => {
  expect(slugForExperimentName(null)).toBe(null);
  expect(slugForExperimentName(undefined)).toBe(null);
  expect(slugForExperimentName('')).toBe(null);
});

test('matches known experiment names case-insensitively', () => {
  expect(slugForExperimentName('Temperature Cycling Test')).toBe('tct');
  expect(slugForExperimentName('HAST')).toBe('hast');
  expect(slugForExperimentName('Highly Accelerated Stress Test')).toBe('hast');
  expect(slugForExperimentName('Bias Temperature Stress')).toBe('btc');
  expect(slugForExperimentName('Circuit Probe')).toBe('cp');
  expect(slugForExperimentName('Final Test')).toBe('ft');
});

// Checks run top-down: 'temperature cycling' is tested before 'bias temperature',
// so a name containing both resolves to 'tct'. Pinning this precedence so a future
// reorder can't silently change classification.
test('prefers tct when a name contains both cycling and bias-temperature', () => {
  expect(slugForExperimentName('Bias Temperature Cycling')).toBe('tct');
});

test('returns null for unknown names', () => {
  expect(slugForExperimentName('Some Other Experiment')).toBe(null);
});

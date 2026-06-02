import assert from 'node:assert/strict';
import test from 'node:test';
import { slugForExperimentName } from './slugForExperimentName.ts';

test('returns null for empty input', () => {
  assert.equal(slugForExperimentName(null), null);
  assert.equal(slugForExperimentName(undefined), null);
  assert.equal(slugForExperimentName(''), null);
});

test('matches known experiment names case-insensitively', () => {
  assert.equal(slugForExperimentName('Temperature Cycling Test'), 'tct');
  assert.equal(slugForExperimentName('HAST'), 'hast');
  assert.equal(slugForExperimentName('Highly Accelerated Stress Test'), 'hast');
  assert.equal(slugForExperimentName('Bias Temperature Stress'), 'btc');
  assert.equal(slugForExperimentName('Circuit Probe'), 'cp');
  assert.equal(slugForExperimentName('Final Test'), 'ft');
});

// Checks run top-down: 'temperature cycling' is tested before 'bias temperature',
// so a name containing both resolves to 'tct'. Pinning this precedence so a future
// reorder can't silently change classification.
test('prefers tct when a name contains both cycling and bias-temperature', () => {
  assert.equal(slugForExperimentName('Bias Temperature Cycling'), 'tct');
});

test('returns null for unknown names', () => {
  assert.equal(slugForExperimentName('Some Other Experiment'), null);
});

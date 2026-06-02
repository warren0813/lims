import { test, expect } from 'vitest';
import TM_EXPERIMENTS from './tmExperiments';

// Static catalogue of test-and-measurement experiments. Assert the shape so a
// malformed edit is caught.

test('exports two experiments', () => {
  expect(TM_EXPERIMENTS).toHaveLength(2);
});

test('every entry has the required keys', () => {
  for (const exp of TM_EXPERIMENTS) {
    expect(exp).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        short: expect.any(String),
        cn: expect.any(String),
        desc: expect.any(String),
      }),
    );
  }
});

test('ids are unique', () => {
  const ids = TM_EXPERIMENTS.map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('includes circuit probing and final test', () => {
  expect(TM_EXPERIMENTS.map((e) => e.id)).toEqual(['cp', 'ft']);
});

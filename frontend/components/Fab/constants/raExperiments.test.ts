import { test, expect } from 'vitest';
import RA_EXPERIMENTS from './raExperiments';

// Static catalogue of reliability-assurance experiments. Assert the shape so a
// fat-fingered edit (missing field, duplicate id) is caught.

test('exports three experiments', () => {
  expect(RA_EXPERIMENTS).toHaveLength(3);
});

test('every entry has the required keys', () => {
  for (const exp of RA_EXPERIMENTS) {
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
  const ids = RA_EXPERIMENTS.map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('includes the temperature cycling test', () => {
  expect(RA_EXPERIMENTS.find((e) => e.id === 'tct')?.short).toBe('TCT');
});

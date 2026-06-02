import { test, expect } from 'vitest';
import RECIPES from './recipes';

// Static recipe catalogue keyed to experiment ids. Assert the shape so a
// malformed edit (missing params, orphaned expId, duplicate id) is caught.

test('exports five recipes', () => {
  expect(RECIPES).toHaveLength(5);
});

test('every recipe has id, expId, name and a params object', () => {
  for (const r of RECIPES) {
    expect(r).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        expId: expect.any(String),
        name: expect.any(String),
        params: expect.any(Object),
      }),
    );
  }
});

test('recipe ids are unique', () => {
  const ids = RECIPES.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('the standard TCT recipe carries its cycle params', () => {
  const tct = RECIPES.find((r) => r.id === 'tct_std');
  expect(tct?.expId).toBe('tct');
  expect(tct?.params).toMatchObject({ cycles: 500 });
});

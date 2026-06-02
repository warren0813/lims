import { test, expect } from 'vitest';
import { getWaferExperimentDisplay } from './waferExperimentDisplay';

test('only displays experiments selected for the wafer', () => {
  // Inlined so the function's parameter types flow onto these literals — under
  // this project's non-strict null checks a bare `verdict: null` would
  // otherwise be inferred as implicit `any`.
  const display = getWaferExperimentDisplay(
    [
      { id: 1, name: 'Temperature Cycling Test', group: 'RA' },
      { id: 5, name: 'Final Test', group: 'TM' },
    ],
    [{ experimentTypeId: 5, experimentName: 'Final Test', status: 'pending', verdict: null }],
  );

  expect(display.experiments.map((experiment) => experiment.id)).toEqual([5]);
  expect(display.total).toBe(1);
  expect(display.doneCount).toBe(0);
});

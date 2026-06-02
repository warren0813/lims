import assert from 'node:assert/strict';
import test from 'node:test';
import { getWaferExperimentDisplay } from './waferExperimentDisplay.ts';

test('only displays experiments selected for the wafer', () => {
  const requestExperiments = [
    { id: 1, name: 'Temperature Cycling Test', group: 'RA' },
    { id: 5, name: 'Final Test', group: 'TM' },
  ];
  const rollup = [
    {
      experimentTypeId: 5,
      experimentName: 'Final Test',
      status: 'pending',
      verdict: null,
    },
  ];

  const display = getWaferExperimentDisplay(requestExperiments, rollup);

  assert.deepEqual(
    display.experiments.map((experiment) => experiment.id),
    [5],
  );
  assert.equal(display.total, 1);
  assert.equal(display.doneCount, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRemaining } from './formatRemaining.ts';

const HOUR = 3600000;
const DAY = 86400000;

test('renders a placeholder when there is no deadline', () => {
  assert.deepEqual(formatRemaining(null), { text: '—', level: 'none' });
  assert.deepEqual(formatRemaining(undefined), { text: '—', level: 'none' });
});

test('renders overdue with a ceiling-rounded day count', () => {
  assert.deepEqual(formatRemaining(-DAY), { text: 'Overdue 1d', level: 'overdue' });
  // 1.04 days overdue rounds up to 2
  assert.deepEqual(formatRemaining(-(DAY + 1000)), { text: 'Overdue 2d', level: 'overdue' });
});

test('renders the same-day window as critical', () => {
  assert.deepEqual(formatRemaining(0), { text: 'Due now', level: 'critical' });
  assert.deepEqual(formatRemaining(5 * HOUR), { text: '5h left', level: 'critical' });
});

test('renders 1-day-and-change as critical with hours', () => {
  assert.deepEqual(formatRemaining(DAY + 2 * HOUR), { text: '1d 2h left', level: 'critical' });
});

test('renders warning (<=3d) and normal (>3d) tiers', () => {
  assert.deepEqual(formatRemaining(2 * DAY), { text: '2d left', level: 'warning' });
  assert.deepEqual(formatRemaining(5 * DAY), { text: '5d left', level: 'normal' });
});

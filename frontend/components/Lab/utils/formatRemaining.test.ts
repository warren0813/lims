import { test, expect } from 'vitest';
import { formatRemaining } from './formatRemaining';

const HOUR = 3600000;
const DAY = 86400000;

test('renders a placeholder when there is no deadline', () => {
  expect(formatRemaining(null)).toEqual({ text: '—', level: 'none' });
  expect(formatRemaining(undefined)).toEqual({ text: '—', level: 'none' });
});

test('renders overdue with a ceiling-rounded day count', () => {
  expect(formatRemaining(-DAY)).toEqual({ text: 'Overdue 1d', level: 'overdue' });
  // 1.04 days overdue rounds up to 2
  expect(formatRemaining(-(DAY + 1000))).toEqual({ text: 'Overdue 2d', level: 'overdue' });
});

test('renders the same-day window as critical', () => {
  expect(formatRemaining(0)).toEqual({ text: 'Due now', level: 'critical' });
  expect(formatRemaining(5 * HOUR)).toEqual({ text: '5h left', level: 'critical' });
});

test('renders 1-day-and-change as critical with hours', () => {
  expect(formatRemaining(DAY + 2 * HOUR)).toEqual({ text: '1d 2h left', level: 'critical' });
});

test('renders warning (<=3d) and normal (>3d) tiers', () => {
  expect(formatRemaining(2 * DAY)).toEqual({ text: '2d left', level: 'warning' });
  expect(formatRemaining(5 * DAY)).toEqual({ text: '5d left', level: 'normal' });
});

// The date helpers every view reads through (lib/dates.js): a date is a day in
// her timezone, labels stay soft past a fortnight, and a recurring date wraps
// into next year. Pure.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { agoLabel, dateLabel, daysAway, daysUntilRecurring, parseISO, untilLabel, yearOf } from '@/lib/dates';

const NOW = new Date(Date.UTC(2026, 9, 8, 12)); // 8 October 2026, noon UTC

describe('parseISO and dateLabel', () => {
  test('a date-only value lands on its own day, not the one before', () => {
    assert.equal(parseISO('2026-03-04').getUTCDate(), 4);
  });
  test('anything that is not YYYY-MM-DD is no date', () => {
    for (const v of ['', null, '4 March', '2026-3-4', '2026-13-01x']) assert.equal(parseISO(v), null);
  });
  test('the long form, never an ambiguous 04/03', () => {
    assert.equal(dateLabel('2026-03-04'), '4 March 2026');
    assert.equal(dateLabel('soon'), 'soon');
  });
  test('the year of a date, or none', () => {
    assert.equal(yearOf('2025-12-31'), 2025);
    assert.equal(yearOf('later'), null);
  });
});

describe('days and the labels on them', () => {
  test('whole days from today, past negative', () => {
    assert.equal(daysAway('2026-10-08', NOW), 0);
    assert.equal(daysAway('2026-10-10', NOW), 2);
    assert.equal(daysAway('2026-10-01', NOW), -7);
  });
  test('what is coming, near to far', () => {
    assert.equal(untilLabel('2026-10-08', NOW), 'today');
    assert.equal(untilLabel('2026-10-09', NOW), 'tomorrow');
    assert.equal(untilLabel('2026-10-11', NOW), 'in 3 days');
    assert.equal(untilLabel('2026-10-17', NOW), 'next week');
    assert.equal(untilLabel('2026-11-05', NOW), 'in 4 weeks');
  });
  test('what has gone stays soft past a fortnight', () => {
    assert.equal(agoLabel('2026-10-07', NOW), 'yesterday');
    assert.equal(agoLabel('2026-10-01', NOW), '7 days ago');
    assert.equal(agoLabel('2026-09-10', NOW), '4 weeks ago');
    // Found by this test: a year back read "1 years ago" (2026-10-08).
    assert.equal(agoLabel('2025-10-08', NOW), '1 year ago');
    assert.equal(agoLabel('2024-10-08', NOW), '2 years ago');
  });
  test('a recurring date counts to its next occurrence, into next year when it has passed', () => {
    assert.equal(daysUntilRecurring('10 October', NOW), 2);
    assert.equal(daysUntilRecurring('8 Oct', NOW), 0);
    const january = daysUntilRecurring('1 January', NOW);
    assert.ok(january > 80 && january < 90, `1 January is next year's, ${january} days on`);
    assert.equal(daysUntilRecurring('someday', NOW), null);
  });
});

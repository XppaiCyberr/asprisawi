import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dailySemangat,
  dailySemangatIndex,
  SEMANGAT_CHANNEL_ID,
  SEMANGAT_TIME_ZONE,
  formatSemangatDate,
  SEMANGAT_MESSAGES
} from '../src/lib/semangat.js';

test('semangat target configuration is hardcoded', () => {
  assert.equal(SEMANGAT_CHANNEL_ID, '1033107468936544332');
  assert.equal(SEMANGAT_TIME_ZONE, 'Asia/Jakarta');
});

test('dailySemangat returns a stable daily motivation message', () => {
  const date = new Date('2026-05-10T03:00:00.000Z');
  const first = dailySemangat(date);
  const second = dailySemangat(date);

  assert.equal(first.title, 'Semangat hari ini');
  assert.equal(first.message, second.message);
  assert.ok(SEMANGAT_MESSAGES.includes(first.message));
  assert.equal(first.footer, formatSemangatDate(date));
});

test('dailySemangatIndex follows the configured time zone day', () => {
  const beforeMidnightJakarta = new Date('2026-05-10T16:59:00.000Z');
  const afterMidnightJakarta = new Date('2026-05-10T17:00:00.000Z');

  assert.equal(dailySemangatIndex(beforeMidnightJakarta, {
    count: 100
  }), 10);
  assert.equal(dailySemangatIndex(afterMidnightJakarta, {
    count: 100
  }), 11);
});

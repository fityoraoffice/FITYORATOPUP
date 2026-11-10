import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryLimiter } from '../src/utils/rateLimit';

test('mengizinkan sampai batas lalu menolak', () => {
  const allow = createMemoryLimiter();
  for (let i = 0; i < 3; i++) assert.equal(allow('k', 3, 1000, 0), true);
  assert.equal(allow('k', 3, 1000, 10), false);
});

test('jendela waktu habis = hitungan mulai ulang', () => {
  const allow = createMemoryLimiter();
  for (let i = 0; i < 3; i++) allow('k', 3, 1000, 0);
  assert.equal(allow('k', 3, 1000, 500), false);
  assert.equal(allow('k', 3, 1000, 1001), true);
});

test('kunci berbeda tidak saling memengaruhi', () => {
  const allow = createMemoryLimiter();
  for (let i = 0; i < 2; i++) allow('a', 2, 1000, 0);
  assert.equal(allow('a', 2, 1000, 1), false);
  assert.equal(allow('b', 2, 1000, 1), true);
});

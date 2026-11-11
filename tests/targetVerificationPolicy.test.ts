import test from 'node:test';
import assert from 'node:assert/strict';
import { isTargetAcceptable, verifyTarget } from '../src/utils/targetVerification';

test('target format-only boleh diproses dengan peringatan dan tidak disebut terverifikasi', async () => {
  const result = await verifyTarget({ productId: 'ewallet', category: 'ewallet', idLabel: 'Nomor HP', userId: '081234567890' });
  assert.equal(result.valid, true);
  assert.equal(result.level, 'format_only');
  assert.equal(isTargetAcceptable(result), true);
});

test('target invalid tetap ditolak', async () => {
  const result = await verifyTarget({ productId: 'ewallet', category: 'ewallet', idLabel: 'Nomor HP', userId: 'abc' });
  assert.equal(result.valid, false);
  assert.equal(isTargetAcceptable(result), false);
});

test('target confirmed tetap diterima', () => {
  assert.equal(isTargetAcceptable({ valid: true, level: 'confirmed' }), true);
});

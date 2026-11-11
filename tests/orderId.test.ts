import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderId } from '../src/utils/orderId';

test('order ID memakai 128-bit random token dan format lama server tetap kompatibel', () => {
  const id = generateOrderId();
  assert.match(id, /^CS-[A-F0-9]{32}$/);
});

test('order ID baru tidak berulang pada batch kecil', () => {
  const ids = new Set(Array.from({ length: 500 }, () => generateOrderId()));
  assert.equal(ids.size, 500);
});

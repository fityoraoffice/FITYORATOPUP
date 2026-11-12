import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSellingPriceFromSupplier,
  calculateMarkupFromCurrentPrice
} from '../src/data/catalog';

test('harga modal supplier Rp833 dengan margin 7% menjadi Rp891', () => {
  assert.equal(calculateSellingPriceFromSupplier(833, 7), 891);
});

test('markup dari harga jual membulatkan ke Rupiah, bukan ke kelipatan Rp500', () => {
  assert.equal(calculateMarkupFromCurrentPrice(833, 7), 891);
  assert.equal(calculateMarkupFromCurrentPrice(1000, 7), 1070);
});

test('harga Rp0 tetap Rp0 dan persentase dibatasi 5–10%', () => {
  assert.equal(calculateMarkupFromCurrentPrice(0, 7), 0);
  assert.equal(calculateMarkupFromCurrentPrice(1000, 99), 1100);
  assert.equal(calculateMarkupFromCurrentPrice(1000, 1), 1050);
});

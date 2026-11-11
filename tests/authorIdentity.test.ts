import test from 'node:test';
import assert from 'node:assert/strict';
import { isKnownAuthorIdentifier } from '../src/utils/authorIdentity';

test('email Author resmi dikenali tanpa membedakan huruf besar/kecil', () => {
  assert.equal(isKnownAuthorIdentifier('fityorastoreoffice@gmail.com'), true);
  assert.equal(isKnownAuthorIdentifier('FITYORASTOREOFFICE@GMAIL.COM'), true);
});

test('username Author yang ditampilkan di form dikenali', () => {
  for (const username of ['cahyo', 'cahyostore', 'admin', 'author', 'fityora', 'fityorastore']) {
    assert.equal(isKnownAuthorIdentifier(username), true, username);
  }
});

test('nomor WhatsApp Author dikenali dalam format lokal dan internasional', () => {
  for (const phone of ['08139525985', '628139525985', '+628139525985', '+62 813-9525-985']) {
    assert.equal(isKnownAuthorIdentifier(phone), true, phone);
  }
});

test('email tambahan dari ADMIN_EMAIL/ADMIN_EMAILS dikenali hanya saat diizinkan server', () => {
  assert.equal(isKnownAuthorIdentifier('owner@example.com'), false);
  assert.equal(isKnownAuthorIdentifier('OWNER@example.com', ['owner@example.com']), true);
});

test('identifier yang tidak terdaftar tetap ditolak', () => {
  for (const value of ['', 'unknown', '081234567890', 'someone@example.com']) {
    assert.equal(isKnownAuthorIdentifier(value), false, value);
  }
});

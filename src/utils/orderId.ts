/** Cryptographically random public tracking ID (128 bits of entropy). */
export function generateOrderId(cryptoProvider: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
    throw new Error('Browser tidak mendukung generator ID pesanan yang aman.');
  }
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `CS-${token}`;
}

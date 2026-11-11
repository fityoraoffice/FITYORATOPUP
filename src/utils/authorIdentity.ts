/** Shared Author identity rules for both browser and server authentication. */
export const OFFICIAL_AUTHOR_EMAIL = 'fityorastoreoffice@gmail.com';

const AUTHOR_USERNAMES = new Set([
  'cahyo',
  'cahyostore',
  'admin',
  'author',
  'fityora',
  'fityorastore',
]);

// Store digits only so 08..., 62..., and +62... input variants resolve consistently.
const AUTHOR_PHONE_DIGITS = new Set(['08139525985', '628139525985']);

export function isKnownAuthorIdentifier(
  value: unknown,
  additionalEmails: readonly string[] = [],
): boolean {
  const identifier = String(value ?? '').trim().toLowerCase();
  if (!identifier) return false;

  const allowedEmails = [OFFICIAL_AUTHOR_EMAIL, ...additionalEmails]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);
  if (identifier.includes('@')) return allowedEmails.includes(identifier);
  if (AUTHOR_USERNAMES.has(identifier)) return true;

  const digits = identifier.replace(/\D/g, '');
  if (!digits) return false;
  const national = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  const international = national.startsWith('0') ? `62${national.slice(1)}` : digits;

  return AUTHOR_PHONE_DIGITS.has(digits)
    || AUTHOR_PHONE_DIGITS.has(national)
    || AUTHOR_PHONE_DIGITS.has(international);
}

/** Header autentikasi Author (token dari login admin; cookie sesi juga ikut terkirim). */
export const ADMIN_TOKEN_STORAGE_KEY = 'cahyo_admin_token_v1';

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  try {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
  } catch {
    // ignore
  }
  return headers;
}

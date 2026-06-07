// Normalization helpers for login/reset forms.
//
// Arabic keyboard layouts and RTL paste sources commonly inject characters
// that look identical to ASCII but are different bytes — Arabic-Indic
// digits (٠-٩), Persian digits (۰-۹), zero-width / BiDi control marks,
// and non-breaking spaces. Supabase Auth compares bytes, so a user can
// type "the same" password and still get `invalid_credentials`.
//
// These helpers are pure no-ops on already-ASCII input.

// Zero-width + BiDi control characters that should never appear in
// an email or password.
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function arabicDigitsToLatin(s: string): string {
  return s.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
          .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

export function normalizeEmail(raw: string): string {
  return raw.replace(INVISIBLE_RE, '').trim().toLowerCase();
}

export function normalizePassword(raw: string): string {
  // Strip invisibles, convert NBSP -> space, normalize Arabic/Persian digits.
  // Do NOT trim or lowercase — passwords are case- and whitespace-sensitive.
  const stripped = raw.replace(INVISIBLE_RE, '').replace(/\u00A0/g, ' ');
  return arabicDigitsToLatin(stripped);
}
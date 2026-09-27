/**
 * The prototype's validation, verbatim (docs/prototype.html → `isEmail` / `isPhone`).
 * Password minimum is 6 characters (CONTRACT §3.5), which matches the same file.
 */

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isPhone = (value: string): boolean => /^[+]?[\d\s()-]{7,}$/.test(value);

/** The login / forgot identifier accepts either form. */
export const isIdentifier = (value: string): boolean => isEmail(value) || isPhone(value);

export const MIN_PASSWORD = 6;

export const isPassword = (value: string): boolean => value.length >= MIN_PASSWORD;

/** `height 100–250 cm`, `weight 30–300 kg` — the prototype's `saveMyDetails` rule. */
export const isHeightCm = (value: number): boolean => value >= 100 && value <= 250;
export const isWeightKg = (value: number): boolean => value >= 30 && value <= 300;

/** Parse a numeric text field, tolerating a comma decimal separator and blank input. */
export function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) {
    return null;
  }
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

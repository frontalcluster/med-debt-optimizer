/**
 * Strips commas and whitespace from a string before numeric parsing.
 * Handles values like "250,000" or "1,234,567.89" that users paste.
 */
export function sanitizeNumericValue(value: string): number {
  return parseFloat(value.replace(/,/g, '').trim()) || 0;
}

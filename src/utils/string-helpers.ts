/**
 * Escape HTML-ish characters in a string. Used by renderers that
 * embed user content into markup: `<` becomes `&lt;`, `>` becomes
 * `&gt;`, and literal tags such as `<br/>` are neutralized.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripControlChars(input: string): string {
  // strip lone CRs, tabs, and other control bytes
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

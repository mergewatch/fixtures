// E2E-36a: presence of this file at the repo root triggers FP-G's
// detectLinters('eslint'), which threads through to STYLE_REVIEWER_PROMPT
// as a LINTER_AWARE_DIRECTIVE telling the style agent to defer
// lint-equivalent findings (semicolons, quote style, import order, etc.).
export default [
  {
    rules: {
      semi: ['error', 'always'],
      'no-unused-vars': 'error',
    },
  },
];

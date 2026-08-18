# acme-notes

A small TypeScript project with a handful of arithmetic and greeting helpers.

## Layout

```
src/
  app.ts          # user-facing entry points (greet)
  utils.ts        # shared pure helpers (add, multiply)
  utils.test.ts   # unit tests (vitest)
scripts/          # repo maintenance scripts
```

## Development

```bash
npm install
npx vitest        # run the unit tests
```

Helpers in `src/utils.ts` are pure functions — keep them side-effect free and covered by a test in `src/utils.test.ts` when you add one.

## Contributing

Open a pull request against `main`. Keep changes small and focused; docs-only fixes are welcome.

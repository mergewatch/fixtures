// E2E-36b: SAME style-noisy code as 36a, but without an eslint.config.mjs at
// the root. detectLinters returns [], no LINTER_AWARE_DIRECTIVE is rendered,
// and the style agent should emit its full set of findings (lint-equivalent
// AND code-smell).
import { readFileSync } from 'fs'
import { unusedHelper } from './unrelated'

export function doManyThings(input: string) {
  if (input.length > 0) {
    if (input.startsWith('A')) {
      if (input.endsWith('Z')) {
        if (input.includes('-')) {
          if (input.split('-').length > 7) {
            return readFileSync(input).toString().slice(0, 42)
          }
        }
      }
    }
  }
  return null
}

export const _foo = unusedHelper

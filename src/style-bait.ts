// E2E-36a: deliberately style-noisy code that would draw both lint-equivalent
// findings (missing semicolons, unused import) AND code-smell findings (god
// function, deep nesting, magic numbers). With eslint.config.mjs at root,
// FP-G must defer the lint-equivalent ones but keep the code-smells.
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

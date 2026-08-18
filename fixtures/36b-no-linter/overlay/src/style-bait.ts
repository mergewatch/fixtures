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

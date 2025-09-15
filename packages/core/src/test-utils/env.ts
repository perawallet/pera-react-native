import { vi } from 'vitest'

export type EnvSnapshot = Record<string, string | undefined>

export const snapshotEnv = (): EnvSnapshot => {
  return { ...process.env }
}

export const restoreEnv = (snap: EnvSnapshot) => {
  process.env = { ...snap }
}

/**
 * Reset the ESM module cache before running a function that re-imports modules.
 * Useful when testing modules that evaluate process.env or singletons at import time.
 */
export const withFreshModules = async <T>(fn: () => Promise<T> | T): Promise<T> => {
  vi.resetModules()
  return await fn()
}
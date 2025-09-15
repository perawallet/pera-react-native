import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { getConfigForEnv, configSchema } from '../main'
import { config as devConfig } from '../development'
import { config as stagingConfig } from '../staging'
import { config as prodConfig } from '../production'

const originalEnv = { ...process.env }

describe('config/main', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.APP_ENV
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('getConfigForEnv maps explicit env values and validates schema', () => {
    // Explicit mappings
    expect(getConfigForEnv('development')).toStrictEqual(configSchema.parse(devConfig))
    expect(getConfigForEnv('dev')).toStrictEqual(configSchema.parse(devConfig))

    expect(getConfigForEnv('staging')).toStrictEqual(configSchema.parse(stagingConfig))
    expect(getConfigForEnv('stage')).toStrictEqual(configSchema.parse(stagingConfig))

    expect(getConfigForEnv('production')).toStrictEqual(configSchema.parse(prodConfig))
    expect(getConfigForEnv('prod')).toStrictEqual(configSchema.parse(prodConfig))

    // Unknown falls back to development
    expect(getConfigForEnv('unknown-env')).toStrictEqual(configSchema.parse(devConfig))

    // Vitest default maps test -> development
    expect(getConfigForEnv('test')).toStrictEqual(configSchema.parse(devConfig))
  })

  test('module default export "config" uses APP_ENV if set (over NODE_ENV)', async () => {
    process.env.APP_ENV = 'staging'
    process.env.NODE_ENV = 'production'

    // Re-import module to evaluate "config" with envs above
    const mod = await import('../main')
    expect(mod.config).toStrictEqual(configSchema.parse(stagingConfig))
  })

  test('module default export "config" uses NODE_ENV when APP_ENV is not set', async () => {
    delete process.env.APP_ENV
    process.env.NODE_ENV = 'production'

    const mod = await import('../main')
    expect(mod.config).toStrictEqual(configSchema.parse(prodConfig))
  })

  test('module default export "config" falls back to development when envs are absent/unknown', async () => {
    delete process.env.APP_ENV
    delete process.env.NODE_ENV

    const mod = await import('../main')
    expect(mod.config).toStrictEqual(configSchema.parse(stagingConfig))

    // Unknown value
    vi.resetModules()
    process.env.APP_ENV = 'unknown'
    const mod2 = await import('../main')
    expect(mod2.config).toStrictEqual(configSchema.parse(devConfig))
  })
})
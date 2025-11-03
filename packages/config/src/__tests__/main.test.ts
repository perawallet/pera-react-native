import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { snapshotEnv, restoreEnv } from '../test-utils'
import { getConfigForEnv, configSchema } from '../main'
import { config as devConfig } from '../development'
import { config as stagingConfig } from '../staging'
import { config as prodConfig } from '../production'

let envSnap: NodeJS.ProcessEnv

describe('config/main', () => {
    beforeEach(() => {
        envSnap = snapshotEnv()
        vi.resetModules()
        delete process.env.APP_ENV
        delete process.env.NODE_ENV
    })

    afterEach(() => {
        restoreEnv(envSnap)
    })

    test('getConfigForEnv maps explicit env values and validates schema', () => {
        // Explicit mappings
        expect(getConfigForEnv('development')).toStrictEqual(
            configSchema.parse(devConfig),
        )
        expect(getConfigForEnv('dev')).toStrictEqual(
            configSchema.parse(devConfig),
        )

        expect(getConfigForEnv('staging')).toStrictEqual(
            configSchema.parse(stagingConfig),
        )
        expect(getConfigForEnv('stage')).toStrictEqual(
            configSchema.parse(stagingConfig),
        )

        expect(getConfigForEnv('production')).toStrictEqual(
            configSchema.parse(prodConfig),
        )
        expect(getConfigForEnv('prod')).toStrictEqual(
            configSchema.parse(prodConfig),
        )

        // Unknown falls back to development
        expect(getConfigForEnv('unknown-env')).toStrictEqual(
            configSchema.parse(devConfig),
        )

        // Vitest default maps test -> development
        expect(getConfigForEnv('test')).toStrictEqual(
            configSchema.parse(devConfig),
        )
    })
})

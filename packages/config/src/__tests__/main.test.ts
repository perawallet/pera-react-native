/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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

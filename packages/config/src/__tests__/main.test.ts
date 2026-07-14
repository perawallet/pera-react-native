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

import { describe, test, expect, vi } from 'vitest'
import { config, configSchema, getConfig } from '../main'

describe('config/main', () => {
    test('config object is frozen', () => {
        expect(Object.isFrozen(config)).toBe(true)
    })

    test('config matches schema', () => {
        const result = configSchema.safeParse(config)
        expect(result.success).toBe(true)
    })

    test('getConfig returns a valid config', () => {
        const result = getConfig()
        expect(configSchema.safeParse(result).success).toBe(true)
    })

    test('exposes bounded-timeout defaults in milliseconds', () => {
        expect(config.algodReadTimeout).toBe(10_000)
        expect(config.algodSubmitTimeout).toBe(30_000)
        expect(config.signingTransportTimeout).toBe(35_000)
    })

    test('schema rejects a non-integer algodReadTimeout', () => {
        const result = configSchema.safeParse({
            ...config,
            algodReadTimeout: 10.5,
        })
        expect(result.success).toBe(false)
    })
})

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

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const globalWithDev = globalThis as { __DEV__?: boolean }

// The flags are computed at module load, so each case resets the module
// registry, pins `config.appEnvironment` (the real value comes from the
// machine-local generated env, which must not steer assertions), arranges
// __DEV__, and re-imports.
const importFlags = async (appEnvironment: string, debug: boolean) => {
    if (debug) {
        globalWithDev.__DEV__ = true
    } else {
        delete globalWithDev.__DEV__
    }
    vi.doMock('../main', () => ({ config: { appEnvironment } }))
    return import('../build-flags')
}

// The four build types: variant (staging|production) × debug (local
// Metro/Expo bundle vs signed release).
describe('build flags', () => {
    let originalDev: boolean | undefined

    beforeEach(() => {
        originalDev = globalWithDev.__DEV__
        vi.resetModules()
    })

    afterEach(() => {
        vi.doUnmock('../main')
        if (originalDev === undefined) {
            delete globalWithDev.__DEV__
        } else {
            globalWithDev.__DEV__ = originalDev
        }
    })

    test('prod (signed store release)', async () => {
        const flags = await importFlags('production', false)
        expect(flags.isProd).toBe(true)
        expect(flags.isStaging).toBe(false)
        expect(flags.isDev).toBe(false)
        expect(flags.isDebug).toBe(false)
    })

    test('prod debug (local build of the production variant)', async () => {
        const flags = await importFlags('production', true)
        expect(flags.isProd).toBe(true)
        expect(flags.isStaging).toBe(false)
        expect(flags.isDev).toBe(false)
        expect(flags.isDebug).toBe(true)
    })

    test('staging (signed Firebase QA release)', async () => {
        const flags = await importFlags('staging', false)
        expect(flags.isProd).toBe(false)
        expect(flags.isStaging).toBe(true)
        expect(flags.isDev).toBe(false)
        expect(flags.isDebug).toBe(false)
    })

    test('staging debug (local build of the staging variant)', async () => {
        const flags = await importFlags('staging', true)
        expect(flags.isProd).toBe(false)
        expect(flags.isStaging).toBe(true)
        expect(flags.isDev).toBe(false)
        expect(flags.isDebug).toBe(true)
    })

    test('local run without APP_ENV is the dev variant, debug with no release variant', async () => {
        const flags = await importFlags('development', true)
        expect(flags.isProd).toBe(false)
        expect(flags.isStaging).toBe(false)
        expect(flags.isDev).toBe(true)
        expect(flags.isDebug).toBe(true)
    })
})

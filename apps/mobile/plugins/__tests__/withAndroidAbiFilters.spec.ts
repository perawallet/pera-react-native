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

import { afterEach, describe, expect, it } from 'vitest'
import { addDebugAbiFilter, getDebugAbis } from '../withAndroidAbiFilters'

// Mirrors the RN/Expo template: a `signingConfigs` block that also opens a
// `debug {` before the `buildTypes` block, so the anchor must skip it.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
        release {
            storeFile file('release.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`

describe('addDebugAbiFilter', () => {
    it('scopes the abiFilters to a single ABI', () => {
        const result = addDebugAbiFilter(TEMPLATE)

        expect(result).toContain("abiFilters 'arm64-v8a'")
        expect(result.match(/abiFilters/g)).toHaveLength(1)
    })

    it('injects into the buildTypes debug block, not signingConfigs or release', () => {
        const result = addDebugAbiFilter(TEMPLATE)

        const buildTypes = result.slice(result.indexOf('buildTypes {'))
        const debugBlock = buildTypes.slice(
            buildTypes.indexOf('debug {'),
            buildTypes.indexOf('release {'),
        )
        const releaseBlock = buildTypes.slice(buildTypes.indexOf('release {'))
        const signingConfigs = result.slice(
            result.indexOf('signingConfigs {'),
            result.indexOf('buildTypes {'),
        )

        expect(debugBlock).toContain('abiFilters')
        expect(releaseBlock).not.toContain('abiFilters')
        expect(signingConfigs).not.toContain('abiFilters')
    })

    it('is idempotent across repeated prebuilds', () => {
        const once = addDebugAbiFilter(TEMPLATE)
        const twice = addDebugAbiFilter(once)

        expect(twice).toBe(once)
        expect(twice.match(/abiFilters/g)).toHaveLength(1)
    })

    it('throws if the debug buildType cannot be found', () => {
        expect(() =>
            addDebugAbiFilter('android {\n    buildTypes {\n    }\n}'),
        ).toThrow(/could not find the debug buildType/)
    })

    it('still scopes debug when an unrelated abiFilters already exists elsewhere', () => {
        // A release-side ndk filter (or any other abiFilters usage) must not
        // make the idempotency guard think debug is already patched — a bare
        // 'abiFilters' substring check would silently no-op here and leave
        // debug unscoped.
        const withReleaseAbiFilters = `android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            ndk {
                abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'
            }
        }
    }
}`

        const result = addDebugAbiFilter(withReleaseAbiFilters)

        const buildTypes = result.slice(result.indexOf('buildTypes {'))
        const debugBlock = buildTypes.slice(
            buildTypes.indexOf('debug {'),
            buildTypes.indexOf('release {'),
        )

        expect(debugBlock).toContain("abiFilters 'arm64-v8a'")
    })

    it('scopes debug to multiple ABIs when overridden (e.g. x86_64 emulator)', () => {
        // The escape hatch for non-arm64 emulators: abiFilters must widen to the
        // requested ABIs, otherwise the APK ships no libs the device can load.
        const result = addDebugAbiFilter(TEMPLATE, ['arm64-v8a', 'x86_64'])

        expect(result).toContain("abiFilters 'arm64-v8a', 'x86_64'")
        expect(result.match(/abiFilters/g)).toHaveLength(1)
    })
})

describe('getDebugAbis', () => {
    afterEach(() => {
        delete process.env.PERA_ANDROID_DEBUG_ABI
    })

    it('defaults to arm64-v8a when the override is unset', () => {
        delete process.env.PERA_ANDROID_DEBUG_ABI

        expect(getDebugAbis()).toEqual(['arm64-v8a'])
    })

    it('parses a comma-separated PERA_ANDROID_DEBUG_ABI override, trimming whitespace', () => {
        process.env.PERA_ANDROID_DEBUG_ABI = ' arm64-v8a , x86_64 '

        expect(getDebugAbis()).toEqual(['arm64-v8a', 'x86_64'])
    })

    it('falls back to the default when the override is blank', () => {
        process.env.PERA_ANDROID_DEBUG_ABI = '   ,  '

        expect(getDebugAbis()).toEqual(['arm64-v8a'])
    })
})

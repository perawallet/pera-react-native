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

import { describe, expect, it } from 'vitest'
import { addDebugAbiFilter } from '../withAndroidAbiFilters'

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
})

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
import { patchAppBuildGradle } from '../withAndroidLegacyApplicationId'

// Mirrors the relevant portion of the Expo / RN template app/build.gradle,
// including the `debug {` inside signingConfigs that the suffix must NOT touch.
const TEMPLATE = `android {
    namespace 'com.algorand.perarn.staging'
    defaultConfig {
        applicationId 'com.algorand.perarn.staging'
        versionCode 1
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
        }
    }
}`

const OPTS = {
    applicationId: 'com.algorand.android.staging',
    debugSuffix: '.debug',
}

describe('patchAppBuildGradle', () => {
    it('rewrites applicationId to the legacy id without touching the namespace', () => {
        const result = patchAppBuildGradle(TEMPLATE, OPTS)

        expect(result).toContain("applicationId 'com.algorand.android.staging'")
        expect(result).not.toContain(
            "applicationId 'com.algorand.perarn.staging'",
        )
        // Namespace (compile-time package) is left alone.
        expect(result).toContain("namespace 'com.algorand.perarn.staging'")
    })

    it('appends applicationIdSuffix to the buildTypes debug block only', () => {
        const result = patchAppBuildGradle(TEMPLATE, OPTS)

        expect(result).toMatch(
            /buildTypes \{\s*debug \{\n\s*applicationIdSuffix "\.debug"/,
        )
        // Exactly one suffix — the signingConfigs `debug {` is untouched.
        expect(result.match(/applicationIdSuffix/g)).toHaveLength(1)
    })

    it('is idempotent across repeated runs', () => {
        const once = patchAppBuildGradle(TEMPLATE, OPTS)
        const twice = patchAppBuildGradle(once, OPTS)

        expect(twice).toBe(once)
    })

    it('skips the suffix when debugSuffix is omitted', () => {
        const result = patchAppBuildGradle(TEMPLATE, {
            applicationId: 'com.algorand.android',
        })

        expect(result).toContain("applicationId 'com.algorand.android'")
        expect(result).not.toContain('applicationIdSuffix')
    })

    it('throws when applicationId is missing', () => {
        expect(() => patchAppBuildGradle(TEMPLATE, {})).toThrow(
            /missing required `applicationId`/,
        )
    })

    it('throws when no applicationId declaration exists to rewrite', () => {
        const malformed = 'android {\n    namespace "com.x"\n}'

        expect(() => patchAppBuildGradle(malformed, OPTS)).toThrow(
            /could not find an `applicationId`/,
        )
    })
})

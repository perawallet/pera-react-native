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
import { setReleaseSigningConfig } from '../withAndroidReleaseSigning'

// Mirrors the relevant portion of the Expo / RN template app/build.gradle.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`

describe('setReleaseSigningConfig', () => {
    it('declares a release signingConfig that reads the keystore from the environment', () => {
        const result = setReleaseSigningConfig(TEMPLATE)

        expect(result).toContain(
            "storeFile file(System.getenv('ANDROID_KEYSTORE_PATH') ?: '../../config/release.keystore')",
        )
        expect(result).toContain(
            "storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')",
        )
        expect(result).toContain("keyAlias System.getenv('ANDROID_KEY_ALIAS')")
        expect(result).toContain(
            "keyPassword System.getenv('ANDROID_KEY_PASSWORD')",
        )
    })

    it('gates the release buildType on the keystore secret, falling back to debug', () => {
        const result = setReleaseSigningConfig(TEMPLATE)

        expect(result).toContain(
            "signingConfig System.getenv('ANDROID_KEYSTORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug",
        )
    })

    it('leaves the debug buildType signing untouched', () => {
        const result = setReleaseSigningConfig(TEMPLATE)

        expect(result).toMatch(
            /debug \{\s*\n\s*signingConfig signingConfigs\.debug\s*\n\s*\}/,
        )
    })

    it('is idempotent', () => {
        const once = setReleaseSigningConfig(TEMPLATE)
        const twice = setReleaseSigningConfig(once)

        expect(twice).toBe(once)
    })

    it('throws if the release buildType signingConfig cannot be found', () => {
        const malformed = 'android {\n    signingConfigs {\n    }\n}'

        expect(() => setReleaseSigningConfig(malformed)).toThrow()
    })
})

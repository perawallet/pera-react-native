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
import { patchAppBuildGradle } from '../withAndroidMigrationDependencies'

// Mirrors the relevant portion of the Expo / RN template app/build.gradle.
const TEMPLATE = `apply plugin: "com.android.application"

android {
    namespace 'com.algorand.android'
}

dependencies {
    implementation("com.facebook.react:react-android")
}`

describe('patchAppBuildGradle', () => {
    it('adds the Tink implementation dependency inside the dependencies block', () => {
        const result = patchAppBuildGradle(TEMPLATE)

        expect(result).toContain(
            'implementation("com.google.crypto.tink:tink-android:1.18.0")',
        )
        // Inserted as the first line of the dependencies block.
        expect(result).toMatch(
            /dependencies \{\n\s*implementation\("com\.google\.crypto\.tink:tink-android:1\.18\.0"\)/,
        )
    })

    it('is idempotent when the dependency is already present', () => {
        const once = patchAppBuildGradle(TEMPLATE)
        const twice = patchAppBuildGradle(once)

        expect(twice).toBe(once)
    })

    it('throws if the dependencies block cannot be found', () => {
        const malformed = "apply plugin: 'com.android.application'\n"

        expect(() => patchAppBuildGradle(malformed)).toThrow(
            /could not find `dependencies \{` block/,
        )
    })
})

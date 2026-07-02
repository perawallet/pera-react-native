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
import { addNativeSymbolUpload } from '../withAndroidNativeSymbolUpload'

// Mirrors the relevant portion of the Expo / RN template app/build.gradle.
const TEMPLATE = `android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`

describe('addNativeSymbolUpload', () => {
    it('emits FULL native debug symbols and enables Crashlytics native upload', () => {
        const result = addNativeSymbolUpload(TEMPLATE)

        expect(result).toContain("debugSymbolLevel 'FULL'")
        expect(result).toContain('nativeSymbolUploadEnabled true')
    })

    it('injects into the release buildType, not debug', () => {
        const result = addNativeSymbolUpload(TEMPLATE)

        const debugBlock = result.slice(
            result.indexOf('debug {'),
            result.indexOf('release {'),
        )
        expect(debugBlock).not.toContain('debugSymbolLevel')
    })

    it('is idempotent across repeated prebuilds', () => {
        const once = addNativeSymbolUpload(TEMPLATE)
        const twice = addNativeSymbolUpload(once)

        expect(twice).toBe(once)
        expect(twice.match(/debugSymbolLevel/g)).toHaveLength(1)
    })

    it('throws if the release buildType cannot be found', () => {
        expect(() => addNativeSymbolUpload('android {\n}')).toThrow(
            /could not find the release buildType/,
        )
    })

    it('applies the crashlytics gradle plugin before the android block', () => {
        const result = addNativeSymbolUpload(TEMPLATE)

        const applyIdx = result.indexOf(
            "apply plugin: 'com.google.firebase.crashlytics'",
        )
        expect(applyIdx).toBeGreaterThanOrEqual(0)
        // The firebaseCrashlytics {} DSL is evaluated during android {}
        // configuration, so the plugin must be applied before that block.
        expect(applyIdx).toBeLessThan(result.indexOf('android {'))
    })

    it('hoists a bottom-applied crashlytics plugin above the android block', () => {
        // Mirrors reality: @react-native-firebase/crashlytics appends the apply
        // at the end of the file.
        const withBottomApply = `${TEMPLATE}\n\napply plugin: 'com.google.gms.google-services'\napply plugin: 'com.google.firebase.crashlytics'\n`

        const result = addNativeSymbolUpload(withBottomApply)

        expect(
            result.match(/apply plugin: 'com\.google\.firebase\.crashlytics'/g),
        ).toHaveLength(1)
        expect(
            result.indexOf("apply plugin: 'com.google.firebase.crashlytics'"),
        ).toBeLessThan(result.indexOf('android {'))
    })
})

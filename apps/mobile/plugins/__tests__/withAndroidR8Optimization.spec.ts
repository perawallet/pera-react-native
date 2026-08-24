/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { useOptimizedProguardFile } from '../withAndroidR8Optimization'

const buildGradle = (proguardFile: string) => `
android {
    buildTypes {
        release {
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("${proguardFile}"), "proguard-rules.pro"
        }
    }
}
`

describe('useOptimizedProguardFile', () => {
    it('swaps the default proguard file for the optimizing one', () => {
        const result: string = useOptimizedProguardFile(
            buildGradle('proguard-android.txt'),
        )

        expect(result).toContain(
            'getDefaultProguardFile("proguard-android-optimize.txt")',
        )
        expect(result).not.toContain(
            'getDefaultProguardFile("proguard-android.txt")',
        )
    })

    it('leaves the project proguard-rules.pro entry alone', () => {
        const result: string = useOptimizedProguardFile(
            buildGradle('proguard-android.txt'),
        )

        expect(result).toContain('"proguard-rules.pro"')
    })

    it('is a no-op when already optimized', () => {
        const already = buildGradle('proguard-android-optimize.txt')

        expect(useOptimizedProguardFile(already)).toBe(already)
    })

    it('throws when the anchor is missing rather than silently skipping', () => {
        expect(() => useOptimizedProguardFile('android { }')).toThrow(
            /could not find getDefaultProguardFile/,
        )
    })
})

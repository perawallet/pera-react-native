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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { replaceJcenterWithMavenCentral } = require('../withCookiesJcenterFix')

// Mirrors the repositories blocks shipped by @react-native-cookies/cookies.
const BUILD_GRADLE = `buildscript {
    if (project == rootProject) {
        repositories {
            google()
            jcenter()
        }
    }
}

repositories {
    google()
    jcenter()
}`

describe('replaceJcenterWithMavenCentral', () => {
    it('replaces every jcenter() call with mavenCentral()', () => {
        const result = replaceJcenterWithMavenCentral(BUILD_GRADLE)

        expect(result).not.toContain('jcenter()')
        expect(result.match(/mavenCentral\(\)/g)).toHaveLength(2)
    })

    it('leaves other repositories untouched', () => {
        const result = replaceJcenterWithMavenCentral(BUILD_GRADLE)

        expect(result.match(/google\(\)/g)).toHaveLength(2)
    })

    it('is idempotent', () => {
        const once = replaceJcenterWithMavenCentral(BUILD_GRADLE)
        const twice = replaceJcenterWithMavenCentral(once)

        expect(twice).toBe(once)
    })

    it('is a no-op when there is no jcenter() call', () => {
        const clean = 'repositories {\n    mavenCentral()\n}'

        expect(replaceJcenterWithMavenCentral(clean)).toBe(clean)
    })
})

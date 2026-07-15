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
import { addUserLeaveHintOverride } from '../withAndroidUserLeaveHintFix'

// Mirrors the shape of the Expo-generated MainActivity.kt.
const MAIN_ACTIVITY = `package com.algorand.android

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"

  override fun invokeDefaultOnBackPressed() {
    super.invokeDefaultOnBackPressed()
  }
}
`

describe('addUserLeaveHintOverride', () => {
    it('injects the onUserLeaveHint override inside the class', () => {
        const result = addUserLeaveHintOverride(MAIN_ACTIVITY)

        expect(result).toContain('override fun onUserLeaveHint()')
        expect(result).toContain('super.onUserLeaveHint()')
        expect(result).toContain('catch (e: NullPointerException)')
        // Inserted before the final class-closing brace.
        expect(result.trimEnd().endsWith('}')).toBe(true)
        expect(result.indexOf('onUserLeaveHint')).toBeLessThan(
            result.lastIndexOf('}'),
        )
    })

    it('is idempotent across repeated prebuilds', () => {
        const once = addUserLeaveHintOverride(MAIN_ACTIVITY)
        const twice = addUserLeaveHintOverride(once)

        expect(twice).toBe(once)
        expect(twice.match(/override fun onUserLeaveHint\(\)/g)).toHaveLength(1)
    })

    it('throws when no class-closing brace is found', () => {
        expect(() =>
            addUserLeaveHintOverride('package com.algorand.android'),
        ).toThrow(/could not find the MainActivity class close/)
    })
})

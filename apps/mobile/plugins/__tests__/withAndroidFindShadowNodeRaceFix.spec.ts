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
import { addFindShadowNodeRaceFix } from '../withAndroidFindShadowNodeRaceFix'

const MAIN_APPLICATION = `package com.algorand.android

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`

describe('addFindShadowNodeRaceFix', () => {
    it('force-overrides the flag right after loadReactNative', () => {
        const result = addFindShadowNodeRaceFix(MAIN_APPLICATION)

        expect(result).toContain(
            'override fun fixFindShadowNodeByTagRaceCondition(): Boolean = true',
        )
        const load = result.indexOf('loadReactNative(this)')
        const override = result.indexOf('dangerouslyForceOverride')
        const dispatch = result.indexOf('ApplicationLifecycleDispatcher')
        expect(load).toBeLessThan(override)
        expect(override).toBeLessThan(dispatch)
    })

    it('is idempotent across repeated prebuilds', () => {
        const once = addFindShadowNodeRaceFix(MAIN_APPLICATION)

        expect(addFindShadowNodeRaceFix(once)).toBe(once)
    })

    it('throws when loadReactNative is missing', () => {
        expect(() =>
            addFindShadowNodeRaceFix('package com.algorand.android'),
        ).toThrow(/could not find loadReactNative/)
    })
})

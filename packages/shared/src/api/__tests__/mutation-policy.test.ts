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
import { onlineManager } from '@tanstack/react-query'
import { NoConnectionError } from '../../errors/network-validation'
import { assertOnline, mutationDefaults } from '../mutation-policy'

afterEach(() => {
    // onlineManager is module-global; restore the optimistic default so one
    // test's offline simulation can't leak into the next.
    onlineManager.setOnline(true)
})

describe('mutationDefaults', () => {
    it("sets networkMode to 'always' so mutationFns run (and reject) offline instead of pausing", () => {
        expect(mutationDefaults.networkMode).toBe('always')
    })

    it('keeps throwOnError false so failures surface as mutation.error, not render-phase throws', () => {
        expect(mutationDefaults.throwOnError).toBe(false)
    })
})

describe('assertOnline', () => {
    it('throws NoConnectionError when the online manager reports offline', () => {
        onlineManager.setOnline(false)
        expect(() => assertOnline()).toThrow(NoConnectionError)
    })

    it('is a no-op when online', () => {
        onlineManager.setOnline(true)
        expect(() => assertOnline()).not.toThrow()
    })
})

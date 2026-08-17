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

import { beforeEach, describe, expect, it } from 'vitest'

import { usePromptStore } from '../promptStore'

describe('promptStore', () => {
    beforeEach(() => {
        usePromptStore.getState().resetState()
    })

    it('records a dismissal', () => {
        usePromptStore.getState().dismiss('terms-acceptance')

        expect(usePromptStore.getState().dismissedIds).toContain(
            'terms-acceptance',
        )
    })

    it('does not duplicate a repeated dismissal', () => {
        usePromptStore.getState().dismiss('terms-acceptance')
        usePromptStore.getState().dismiss('terms-acceptance')

        expect(usePromptStore.getState().dismissedIds).toEqual([
            'terms-acceptance',
        ])
    })

    it('keeps a repeated dismissal referentially stable', () => {
        usePromptStore.getState().dismiss('terms-acceptance')
        const first = usePromptStore.getState().dismissedIds

        usePromptStore.getState().dismiss('terms-acceptance')

        // A fresh array on every no-op dismissal re-renders every subscriber.
        expect(usePromptStore.getState().dismissedIds).toBe(first)
    })

    it('pays the entry delay once', () => {
        expect(usePromptStore.getState().hasPaidEntryDelay).toBe(false)

        usePromptStore.getState().markEntryDelayPaid()

        expect(usePromptStore.getState().hasPaidEntryDelay).toBe(true)
    })

    it('resets every field', () => {
        usePromptStore.getState().dismiss('terms-acceptance')
        usePromptStore.getState().markEntryDelayPaid()

        usePromptStore.getState().resetState()

        expect(usePromptStore.getState().dismissedIds).toEqual([])
        expect(usePromptStore.getState().hasPaidEntryDelay).toBe(false)
    })
})

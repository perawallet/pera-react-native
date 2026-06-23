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

import { renderHook } from '@test-utils/render'
import { describe, it, expect } from 'vitest'

import { useWalletInstructionsSheet } from '../useWalletInstructionsSheet'

describe('useWalletInstructionsSheet', () => {
    it('returns the Apple Wallet title and 5 steps for the apple platform', () => {
        const { result } = renderHook(() => useWalletInstructionsSheet('apple'))

        // The test i18n returns raw keys, so assert on the key.
        expect(result.current.title).toBe(
            'peraCard.wallet_instructions.apple_title',
        )
        expect(result.current.steps).toHaveLength(5)
    })

    it('returns the Google Pay title and 7 steps for the google platform', () => {
        const { result } = renderHook(() =>
            useWalletInstructionsSheet('google'),
        )

        expect(result.current.title).toBe(
            'peraCard.wallet_instructions.google_title',
        )
        expect(result.current.steps).toHaveLength(7)
    })
})

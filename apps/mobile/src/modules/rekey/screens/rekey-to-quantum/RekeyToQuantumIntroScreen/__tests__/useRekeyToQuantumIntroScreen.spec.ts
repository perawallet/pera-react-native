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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRekeyToQuantumIntroScreen } from '../useRekeyToQuantumIntroScreen'

import en from '@i18n/locales/en.json'

describe('useRekeyToQuantumIntroScreen', () => {
    // Neither half of this pairing is visible to `lint:i18n` — the keys are
    // built dynamically and its namespace claim covers anything under them — so
    // a mismatch renders the raw key string on screen with every check green.
    it('keeps expectationCount in sync with the expect_N keys in en.json', () => {
        const { result } = renderHook(() => useRekeyToQuantumIntroScreen())

        const copy: Record<string, string> = en.rekey.to_quantum.intro
        const { expectationCount } = result.current

        for (let n = 1; n <= expectationCount; n++) {
            expect(copy[`expect_${n}`]).toBeTruthy()
        }
        expect(copy[`expect_${expectationCount + 1}`]).toBeUndefined()
    })

    // A missing key renders as the raw key string on the screen, which no
    // integration test asserting testIDs would catch.
    it('resolves the title to a real en.json string', () => {
        const { result } = renderHook(() => useRekeyToQuantumIntroScreen())

        const copy: Record<string, string> = en.rekey.to_quantum.intro

        expect(result.current.i18nBaseKey).toBe('rekey.to_quantum.intro')
        expect(copy.title).toBeTruthy()
    })
})

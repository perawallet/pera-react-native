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
    // Order only: an extra expect_N in en.json fails no-unused-translation-keys.
    it('lists every expect_N line in en.json, in order', () => {
        const { result } = renderHook(() => useRekeyToQuantumIntroScreen())

        const copy: Record<string, string> = en.rekey.to_quantum.intro
        const expectKeys = Object.keys(copy).filter(key =>
            /^expect_\d+$/.test(key),
        )

        expect(result.current.copy.expectationKeys).toEqual(
            expectKeys.map(key => `rekey.to_quantum.intro.${key}`),
        )
    })

    it('points the screen copy at the quantum intro namespace', () => {
        const { result } = renderHook(() => useRekeyToQuantumIntroScreen())

        expect(result.current.copy).toMatchObject({
            titleKey: 'rekey.to_quantum.intro.title',
            bodyKey: 'rekey.to_quantum.intro.body',
            ctaKey: 'rekey.to_quantum.intro.cta',
        })
    })
})

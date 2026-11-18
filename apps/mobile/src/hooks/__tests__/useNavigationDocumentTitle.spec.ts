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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNavigationDocumentTitle } from '../useNavigationDocumentTitle'

vi.mock('../useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => `translated:${key}` }),
}))

const route = { key: 'SingleTransaction', name: 'SingleTransaction' }

describe('useNavigationDocumentTitle', () => {
    it('writes a screen title key as its translation', () => {
        const { result } = renderHook(() => useNavigationDocumentTitle())

        expect(
            result.current.formatter?.(
                { title: 'signing.transactions.title_one' },
                route,
            ),
        ).toBe('translated:signing.transactions.title_one')
    })

    it('keeps the current title for a screen without one, rather than its route name', () => {
        document.title = 'Pera Wallet'
        const { result } = renderHook(() => useNavigationDocumentTitle())

        expect(result.current.formatter?.({}, route)).toBe('Pera Wallet')
    })
})

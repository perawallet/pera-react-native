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

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLanguage } from '../useLanguage'
import { useTranslation } from 'react-i18next'

vi.mock('react-i18next', () => ({
    useTranslation: vi.fn(),
}))

describe('useLanguage', () => {
    const mockChangeLanguage = vi.fn()
    const mockT = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useTranslation as Mock).mockReturnValue({
            t: mockT,
            i18n: {
                language: 'en',
                changeLanguage: mockChangeLanguage,
            },
        })
    })

    it('should return current language and translation function', () => {
        const { result } = renderHook(() => useLanguage())

        expect(result.current.currentLanguage).toBe('en')
        expect(result.current.t).toBe(mockT)
    })

    it('should change language', () => {
        const { result } = renderHook(() => useLanguage())

        act(() => {
            result.current.changeLanguage('tr')
        })

        expect(mockChangeLanguage).toHaveBeenCalledWith('tr')
    })
})

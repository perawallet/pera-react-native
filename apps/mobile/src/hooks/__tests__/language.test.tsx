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

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { create, act } from 'react-test-renderer'
import { useLanguage } from '../language'
import { useTranslation } from 'react-i18next'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
    useTranslation: vi.fn(),
}))

describe('useLanguage', () => {
    const changeLanguageMock = vi.fn()
    const tMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useTranslation as any).mockReturnValue({
            t: tMock,
            i18n: {
                language: 'en',
                changeLanguage: changeLanguageMock,
            },
        })
    })

    it('returns current language and translation function', () => {
        let hookResult: any
        const TestComponent = () => {
            hookResult = useLanguage()
            return null
        }

        act(() => {
            create(<TestComponent />)
        })

        expect(hookResult).toBeDefined()
        expect(hookResult.currentLanguage).toBe('en')
        expect(hookResult.t).toBe(tMock)
    })

    it('changes language', () => {
        let hookResult: any
        const TestComponent = () => {
            hookResult = useLanguage()
            return null
        }

        act(() => {
            create(<TestComponent />)
        })

        act(() => {
            hookResult.changeLanguage('fr')
        })

        expect(changeLanguageMock).toHaveBeenCalledWith('fr')
    })
})

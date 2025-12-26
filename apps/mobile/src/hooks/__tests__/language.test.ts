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

import { renderHook, act } from '@testing-library/react-native'
import { useLanguage } from '../language'
import { useTranslation } from 'react-i18next'

jest.mock('react-i18next', () => ({
    useTranslation: jest.fn(),
}))

describe('useLanguage', () => {
    const mockChangeLanguage = jest.fn()
    const mockT = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
            ; (useTranslation as jest.Mock).mockReturnValue({
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

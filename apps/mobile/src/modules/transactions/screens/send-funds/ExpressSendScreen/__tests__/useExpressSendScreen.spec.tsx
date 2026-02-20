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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExpressSendScreen } from '../useExpressSendScreen'

const mockNavigate = vi.fn()
const mockReplace = vi.fn()
const mockHasPreference = vi.fn()
const mockSetPreference = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        hasPreference: mockHasPreference,
        setPreference: mockSetPreference,
    }),
}))

describe('useExpressSendScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHasPreference.mockReturnValue(false)
    })

    it('auto-navigates to ConfirmTransaction when warning was previously dismissed', () => {
        mockHasPreference.mockReturnValue(true)

        renderHook(() => useExpressSendScreen())

        expect(mockReplace).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('does not auto-navigate when warning has not been dismissed', () => {
        renderHook(() => useExpressSendScreen())

        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('navigates to ConfirmTransaction on handleContinue', () => {
        const { result } = renderHook(() => useExpressSendScreen())

        result.current.handleContinue()

        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('saves preference and navigates on handleDontShowAgain', () => {
        const { result } = renderHook(() => useExpressSendScreen())

        result.current.handleDontShowAgain()

        expect(mockSetPreference).toHaveBeenCalledWith(
            'express-send-warning-dismissed',
            'true',
        )
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })
})

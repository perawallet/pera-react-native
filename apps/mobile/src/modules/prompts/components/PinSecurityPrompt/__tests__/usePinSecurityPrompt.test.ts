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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinSecurityPrompt } from '../usePinSecurityPrompt'
import { useNavigation } from '@react-navigation/native'
import { UserPreferences } from '@constants/user-preferences'

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

describe('usePinSecurityPrompt', () => {
    const mockNavigate = vi.fn()
    const mockOnDismiss = vi.fn()
    const mockOnHide = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useNavigation as Mock).mockReturnValue({
            navigate: mockNavigate,
        })
    })

    it('should return handler functions', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        expect(typeof result.current.handleSetPinCode).toBe('function')
        expect(typeof result.current.handleNotNow).toBe('function')
        expect(typeof result.current.handleDontAskAgain).toBe('function')
    })

    it('should call onHide and navigate to SecuritySettings when handleSetPinCode is called', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        act(() => {
            result.current.handleSetPinCode()
        })

        expect(mockOnHide).toHaveBeenCalledWith(
            UserPreferences.securityPinSetupPrompt,
        )
        expect(mockNavigate).toHaveBeenCalledWith('Settings', {
            screen: 'SecuritySettings',
        })
    })

    it('should call onHide when handleNotNow is called', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        act(() => {
            result.current.handleNotNow()
        })

        expect(mockOnHide).toHaveBeenCalledWith(
            UserPreferences.securityPinSetupPrompt,
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should call onDismiss when handleDontAskAgain is called', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        act(() => {
            result.current.handleDontAskAgain()
        })

        expect(mockOnDismiss).toHaveBeenCalledWith(
            UserPreferences.securityPinSetupPrompt,
        )
        expect(mockOnHide).not.toHaveBeenCalled()
    })

    it('should not call navigate when handleNotNow is called', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        act(() => {
            result.current.handleNotNow()
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should not call navigate when handleDontAskAgain is called', () => {
        const { result } = renderHook(() =>
            usePinSecurityPrompt({
                onDismiss: mockOnDismiss,
                onHide: mockOnHide,
            }),
        )

        act(() => {
            result.current.handleDontAskAgain()
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })
})

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
import { useSigningActionButtons } from '../useSigningActionButtons'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
    useSigningRequestAnalysis: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

describe('useSigningActionButtons', () => {
    const mockSignAndSendRequest = vi.fn()
    const mockRejectRequest = vi.fn()
    const mockNavigate = vi.fn()
    const mockGetPreference = vi.fn()
    const mockRequest = { id: 'test', transport: 'algod', txs: [] }

    beforeEach(() => {
        vi.clearAllMocks()
        mockSignAndSendRequest.mockResolvedValue(undefined)
        mockGetPreference.mockReturnValue(undefined)
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: mockRequest,
            signAndSendRequest: mockSignAndSendRequest,
            rejectRequest: mockRejectRequest,
        })
        ;(useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            warnings: [],
        })
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
        })
        ;(useNavigation as Mock).mockReturnValue({
            navigate: mockNavigate,
        })
    })

    it('signs directly when there are no rekey warnings', async () => {
        const { result } = renderHook(() => useSigningActionButtons())

        await act(async () => {
            result.current.handleSignAndSend()
        })

        expect(mockSignAndSendRequest).toHaveBeenCalledWith(mockRequest)
        expect(result.current.isRekeyGuardOpen).toBe(false)
    })

    it('opens rekey guard instead of signing when rekey warnings exist', () => {
        ;(useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            warnings: [
                {
                    type: 'rekey',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isRekeyGuardOpen).toBe(true)
        expect(mockSignAndSendRequest).not.toHaveBeenCalled()
    })

    it('proceeds with signing when rekey guard is confirmed', async () => {
        ;(useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            warnings: [
                {
                    type: 'rekey',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isRekeyGuardOpen).toBe(true)

        await act(async () => {
            result.current.handleRekeyConfirm()
        })

        expect(result.current.isRekeyGuardOpen).toBe(false)
        expect(mockSignAndSendRequest).toHaveBeenCalledWith(mockRequest)
    })

    it('navigates to settings when go-to-settings is pressed', () => {
        ;(useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            warnings: [
                {
                    type: 'rekey',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        act(() => {
            result.current.handleRekeyGoToSettings()
        })

        expect(result.current.isRekeyGuardOpen).toBe(false)
        expect(mockNavigate).toHaveBeenCalledWith('RekeySettings')
    })

    it('closes rekey guard without signing when dismissed', () => {
        ;(useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            warnings: [
                {
                    type: 'rekey',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isRekeyGuardOpen).toBe(true)

        act(() => {
            result.current.closeRekeyGuard()
        })

        expect(result.current.isRekeyGuardOpen).toBe(false)
        expect(mockSignAndSendRequest).not.toHaveBeenCalled()
    })
})

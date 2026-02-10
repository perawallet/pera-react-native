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
    useBalanceValidation,
    useSigningRequest,
    useSigningRequestAnalysis,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useBalanceValidation: vi.fn(),
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
            ; (useSigningRequest as Mock).mockReturnValue({
                currentRequest: mockRequest,
                signAndSendRequest: mockSignAndSendRequest,
                rejectRequest: mockRejectRequest,
            })
            ; (useSigningRequestAnalysis as Mock).mockReturnValue({
                allTransactions: [],
                signableAddresses: new Set(),
                warnings: [],
            })
            ; (useBalanceValidation as Mock).mockReturnValue({
                validation: { isValid: true, errors: [] },
                isLoading: false,
            })
            ; (usePreferences as Mock).mockReturnValue({
                getPreference: mockGetPreference,
            })
            ; (useNavigation as Mock).mockReturnValue({
                navigate: mockNavigate,
            })
    })

    it('signs directly when there are no guarded warnings', async () => {
        const { result } = renderHook(() => useSigningActionButtons())

        await act(async () => {
            result.current.handleSignAndSend()
        })

        expect(mockSignAndSendRequest).toHaveBeenCalledWith(mockRequest)
        expect(result.current.isSecurityGuardOpen).toBe(false)
    })

    it('opens security guard instead of signing when rekey warnings exist', () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
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

        expect(result.current.isSecurityGuardOpen).toBe(true)
        expect(result.current.guardedWarningType).toBe('rekey')
        expect(mockSignAndSendRequest).not.toHaveBeenCalled()
    })

    it('opens security guard when asset-freeze warnings exist', () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
            warnings: [
                {
                    type: 'asset-freeze',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isSecurityGuardOpen).toBe(true)
        expect(result.current.guardedWarningType).toBe('asset-freeze')
        expect(mockSignAndSendRequest).not.toHaveBeenCalled()
    })

    it('prioritizes disabled type when both rekey and asset-freeze exist', () => {
        mockGetPreference.mockImplementation((key: string) => {
            if (key === 'rekey-support-enabled') return true
            return undefined
        })
            ; (useSigningRequestAnalysis as Mock).mockReturnValue({
                allTransactions: [],
                signableAddresses: new Set(),
                warnings: [
                    {
                        type: 'rekey',
                        senderAddress: 'addr1',
                        targetAddress: 'addr2',
                    },
                    {
                        type: 'asset-freeze',
                        senderAddress: 'addr1',
                        targetAddress: 'addr3',
                    },
                ],
            })

        const { result } = renderHook(() => useSigningActionButtons())

        // rekey is enabled, asset-freeze is not — guard should show asset-freeze
        expect(result.current.guardedWarningType).toBe('asset-freeze')
    })

    it('shows rekey guard when both exist and neither is enabled', () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
            warnings: [
                {
                    type: 'rekey',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
                {
                    type: 'asset-freeze',
                    senderAddress: 'addr1',
                    targetAddress: 'addr3',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        // both disabled — rekey comes first in priority order
        expect(result.current.guardedWarningType).toBe('rekey')
    })

    it('shows rekey confirmation when both exist and both are enabled', () => {
        mockGetPreference.mockImplementation((key: string) => {
            if (key === 'rekey-support-enabled') return true
            if (key === 'asset-freeze-support-enabled') return true
            return undefined
        })
            ; (useSigningRequestAnalysis as Mock).mockReturnValue({
                allTransactions: [],
                signableAddresses: new Set(),
                warnings: [
                    {
                        type: 'rekey',
                        senderAddress: 'addr1',
                        targetAddress: 'addr2',
                    },
                    {
                        type: 'asset-freeze',
                        senderAddress: 'addr1',
                        targetAddress: 'addr3',
                    },
                ],
            })

        const { result } = renderHook(() => useSigningActionButtons())

        // both enabled — show "are you sure?" for rekey (first in priority)
        expect(result.current.guardedWarningType).toBe('rekey')
    })

    it('proceeds with signing when security guard is confirmed', async () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
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

        expect(result.current.isSecurityGuardOpen).toBe(true)

        await act(async () => {
            result.current.handleSecurityGuardConfirm()
        })

        expect(result.current.isSecurityGuardOpen).toBe(false)
        expect(mockSignAndSendRequest).toHaveBeenCalledWith(mockRequest)
    })

    it('navigates to settings when go-to-settings is pressed', () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
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
            result.current.handleSecurityGuardGoToSettings()
        })

        expect(result.current.isSecurityGuardOpen).toBe(false)
        expect(mockNavigate).toHaveBeenCalledWith('SecuritySettings')
    })

    it('closes security guard without signing when dismissed', () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
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

        expect(result.current.isSecurityGuardOpen).toBe(true)

        act(() => {
            result.current.closeSecurityGuard()
        })

        expect(result.current.isSecurityGuardOpen).toBe(false)
        expect(mockSignAndSendRequest).not.toHaveBeenCalled()
    })

    it('does not trigger guard for close warnings only', async () => {
        ; (useSigningRequestAnalysis as Mock).mockReturnValue({
            allTransactions: [],
            signableAddresses: new Set(),
            warnings: [
                {
                    type: 'close',
                    senderAddress: 'addr1',
                    targetAddress: 'addr2',
                },
            ],
        })

        const { result } = renderHook(() => useSigningActionButtons())

        expect(result.current.guardedWarningType).toBeNull()

        await act(async () => {
            result.current.handleSignAndSend()
        })

        expect(mockSignAndSendRequest).toHaveBeenCalledWith(mockRequest)
        expect(result.current.isSecurityGuardOpen).toBe(false)
    })
})

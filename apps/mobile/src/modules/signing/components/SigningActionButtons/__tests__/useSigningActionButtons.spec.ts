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
    useSigningPipeline,
    type TransactionWarning,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(() => ({ showError: vi.fn() })),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

describe('useSigningActionButtons', () => {
    const mockNext = vi.fn()
    const mockFail = vi.fn()
    const mockNavigate = vi.fn()
    const mockGetPreference = vi.fn()
    const mockRequest = { id: 'test', transport: 'algod', txs: [] }

    const setupPipeline = (
        warnings: TransactionWarning[] = [],
        allTransactions: unknown[] = [],
    ) => {
        ;(useSigningPipeline as Mock).mockReturnValue({
            currentRequest: mockRequest,
            allTransactions,
            warnings,
            isLoading: false,
            next: mockNext,
            fail: mockFail,
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockGetPreference.mockReturnValue(undefined)
        setupPipeline()
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
        })
        ;(useNavigation as Mock).mockReturnValue({
            navigate: mockNavigate,
        })
    })

    it('signs directly when there are no guarded warnings', () => {
        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(result.current.isSecurityGuardOpen).toBe(false)
    })

    it('opens security guard instead of signing when rekey warnings exist', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isSecurityGuardOpen).toBe(true)
        expect(result.current.guardedWarningType).toBe('rekey')
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('opens security guard when asset-freeze warnings exist', () => {
        setupPipeline([
            {
                type: 'asset-freeze',
                senderAddress: 'addr1',
                targetAddress: 'addr2',
            },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isSecurityGuardOpen).toBe(true)
        expect(result.current.guardedWarningType).toBe('asset-freeze')
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('prioritizes disabled type when both rekey and asset-freeze exist', () => {
        mockGetPreference.mockImplementation((key: string) => {
            if (key === 'rekey-support-enabled') return true
            return undefined
        })
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
            {
                type: 'asset-freeze',
                senderAddress: 'addr1',
                targetAddress: 'addr3',
            },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        // rekey is enabled, asset-freeze is not — guard should show asset-freeze
        expect(result.current.guardedWarningType).toBe('asset-freeze')
    })

    it('shows rekey guard when both exist and neither is enabled', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
            {
                type: 'asset-freeze',
                senderAddress: 'addr1',
                targetAddress: 'addr3',
            },
        ])

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
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
            {
                type: 'asset-freeze',
                senderAddress: 'addr1',
                targetAddress: 'addr3',
            },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        // both enabled — show "are you sure?" for rekey (first in priority)
        expect(result.current.guardedWarningType).toBe('rekey')
    })

    it('proceeds with signing when security guard is confirmed', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isSecurityGuardOpen).toBe(true)

        act(() => {
            result.current.handleSecurityGuardConfirm()
        })

        expect(result.current.isSecurityGuardOpen).toBe(false)
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('navigates to settings when go-to-settings is pressed', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

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
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(result.current.isSecurityGuardOpen).toBe(true)

        act(() => {
            result.current.closeSecurityGuard()
        })

        expect(result.current.isSecurityGuardOpen).toBe(false)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('does not trigger guard for close warnings only', () => {
        setupPipeline([
            { type: 'close', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        expect(result.current.guardedWarningType).toBeNull()

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(result.current.isSecurityGuardOpen).toBe(false)
    })
})

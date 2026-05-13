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
    useSigningRequest,
    type TransactionWarning,
    type SigningPipelineEvent,
} from '@perawallet/wallet-core-signing'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'
import { useErrorToast } from '@hooks/useErrorToast'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
    useSigningRequest: vi.fn(),
    isTransactionRequest: vi.fn(() => false),
    resolveSignerAddress: vi.fn((req: { txs?: { sender?: unknown }[] }) => {
        const sender = req?.txs?.[0]?.sender as
            | { toString?: () => string }
            | string
            | undefined
        if (!sender) return undefined
        if (typeof sender === 'string') return sender
        return sender.toString?.()
    }),
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
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: undefined,
        })
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

    describe('signing_failed handling', () => {
        const HW_ADDR = 'HW_ADDR'
        const LOCAL_ADDR = 'LOCAL_ADDR'

        const hwAccount = {
            type: 'hardware',
            address: HW_ADDR,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as never

        const localAccount = {
            type: 'algo25',
            address: LOCAL_ADDR,
            keyPairId: 'kp1',
        } as never

        const showError = vi.fn()
        let capturedHandler: ((event: SigningPipelineEvent) => void) | undefined

        const setupPipelineCapturingHandler = (
            currentRequest: unknown,
        ): void => {
            ;(useSigningPipeline as Mock).mockImplementation(
                ({
                    onEvent,
                }: {
                    onEvent: (event: SigningPipelineEvent) => void
                }) => {
                    capturedHandler = onEvent
                    return {
                        currentRequest,
                        allTransactions: [],
                        warnings: [],
                        isLoading: false,
                        next: mockNext,
                        fail: mockFail,
                    }
                },
            )
        }

        beforeEach(() => {
            capturedHandler = undefined
            showError.mockClear()
            ;(useErrorToast as Mock).mockReturnValue({ showError })
            ;(useAllAccounts as Mock).mockReturnValue([hwAccount, localAccount])
            // `isHardwareWalletAccount` is globally mocked in vitest.setup.ts
            // to return true when `account.type === 'hardware'`, which matches
            // the `hwAccount` fixture above. No per-test override is needed.
        })

        it('skips showError when the failed request is for a hardware account', () => {
            setupPipelineCapturingHandler({
                id: 'r1',
                transport: 'algod',
                txs: [{ sender: { toString: () => HW_ADDR } }],
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).not.toHaveBeenCalled()
        })

        it('calls showError when the failed request is for a local-key account', () => {
            setupPipelineCapturingHandler({
                id: 'r2',
                transport: 'algod',
                txs: [{ sender: { toString: () => LOCAL_ADDR } }],
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).toHaveBeenCalledOnce()
        })

        it('skips showError when transport is not algod (existing behavior preserved)', () => {
            setupPipelineCapturingHandler({
                id: 'r3',
                transport: 'walletconnect',
                txs: [{ sender: { toString: () => LOCAL_ADDR } }],
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).not.toHaveBeenCalled()
        })
    })
})

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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSigningActionButtons } from '../useSigningActionButtons'
import {
    getRekeyedUnsignableReason,
    isSignRequestMultisigUnsignable,
    useSigningPipeline,
    useSigningRequest,
    type TransactionWarning,
    type SigningPipelineEvent,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'
import { useErrorToast } from '@hooks/useErrorToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { trackEvent } from '@analytics'

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    WalletConnectEvent: {
        TransactionConfirmed: 'wc_transaction_confirmed',
        TransactionDeclined: 'wc_transaction_declined',
    },
    AnalyticsMetadataKey: {
        DappName: 'dapp_name',
        DappUrl: 'dapp_url',
        TransactionCount: 'transaction_count',
    },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
    useSigningRequest: vi.fn(),
    isSignRequestMultisigUnsignable: vi.fn(() => false),
    getRekeyedUnsignableReason: vi.fn(() => null),
    isExternalCallbackSource: vi.fn(
        (sourceType?: string) =>
            sourceType === 'walletconnect' ||
            sourceType === 'webview' ||
            sourceType === 'deeplink' ||
            sourceType === 'injected',
    ),
    resolveAllSignerAddresses: vi.fn(() => ['QUANTUMADDRESS']),
}))

const mockConfirmQuantumDappUsage = vi.fn()
vi.mock('@hooks/useQuantumDappWarning', () => ({
    useQuantumDappWarning: () => ({
        confirmQuantumDappUsage: mockConfirmQuantumDappUsage,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// The global setup stubs toAlgodError to always return unknown_node_error;
// the classification cases below need the real parser.
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-blockchain')>(),
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
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

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))

describe('useSigningActionButtons', () => {
    const mockNext = vi.fn()
    const mockFail = vi.fn()
    const mockNavigate = vi.fn()
    const mockGetPreference = vi.fn()
    const mockRequestBottomSheet = vi.fn()
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
            resolved: null,
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // clearAllMocks keeps implementations — pin the gates back to their
        // permissive defaults so cases from one describe can't leak.
        ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(false)
        ;(getRekeyedUnsignableReason as Mock).mockReturnValue(null)
        mockGetPreference.mockReturnValue(undefined)
        mockConfirmQuantumDappUsage.mockResolvedValue('continue')
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
        mockRequestBottomSheet.mockResolvedValue(undefined)
        ;(useBottomSheet as Mock).mockReturnValue({
            request: mockRequestBottomSheet,
        })
    })

    it('signs directly when there are no guarded warnings', () => {
        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('opens security guard sheet instead of signing when rekey warnings exist', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('opens security guard sheet when asset-freeze warnings exist', () => {
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

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('proceeds with signing when security guard resolves with confirm', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue('confirm')

        const { result } = renderHook(() => useSigningActionButtons())
        const initialResetKey = result.current.slideResetKey

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockNext).toHaveBeenCalledTimes(1)
        })
        // Proceeding to signing should leave the slider as-is (loading drives it).
        expect(result.current.slideResetKey).toBe(initialResetKey)
    })

    it('navigates to settings and resets the slider when guard resolves with go-to-settings', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue('go-to-settings')

        const { result } = renderHook(() => useSigningActionButtons())
        const initialResetKey = result.current.slideResetKey

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('SecuritySettings')
        })
        expect(mockNext).not.toHaveBeenCalled()
        // Slider remounts (key bumps) so it is unslid when the user returns.
        expect(result.current.slideResetKey).not.toBe(initialResetKey)
    })

    it('does not call next and resets the slider when guard is dismissed', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() => useSigningActionButtons())
        const initialResetKey = result.current.slideResetKey

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })

        expect(mockNext).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(result.current.slideResetKey).not.toBe(initialResetKey)
    })

    it('does not trigger guard for close warnings only', () => {
        setupPipeline([
            {
                type: 'close-account',
                senderAddress: 'addr1',
                targetAddress: 'addr2',
            },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    describe('signing_failed handling', () => {
        const showError = vi.fn()
        let capturedHandler: ((event: SigningPipelineEvent) => void) | undefined

        const setupPipelineCapturingHandler = (resolved: unknown): void => {
            ;(useSigningPipeline as Mock).mockImplementation(
                ({
                    onEvent,
                }: {
                    onEvent: (event: SigningPipelineEvent) => void
                }) => {
                    capturedHandler = onEvent
                    return {
                        currentRequest: mockRequest,
                        allTransactions: [],
                        warnings: [],
                        isLoading: false,
                        next: mockNext,
                        fail: mockFail,
                        resolved,
                    }
                },
            )
        }

        beforeEach(() => {
            capturedHandler = undefined
            showError.mockClear()
            ;(useErrorToast as Mock).mockReturnValue({ showError })
        })

        it('skips showError when the resolved signer is hardware', () => {
            setupPipelineCapturingHandler({
                signerType: 'hardware',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
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

        it('calls showError when the resolved signer is a local key over algod', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
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

        it('classifies a recognized algod rejection into a typed AlgodError', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
            })

            renderHook(() => useSigningActionButtons())

            const AUTH =
                'PNVR2DIQNNCRVQFVVIVOZH4LWDOYRERK7VIQEWTUYAJRTLNLZY2M2SUENM'
            const ACTUAL =
                'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'
            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error(
                        `Transport failed: transaction X: should have been authorized by ${AUTH} but was actually authorized by ${ACTUAL}`,
                    ),
                } as SigningPipelineEvent)
            })

            expect(showError).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'not_authorized' }),
                expect.any(String),
                expect.anything(),
            )
        })

        it('passes an unrecognized error through unchanged', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
            })

            renderHook(() => useSigningActionButtons())

            const error = new Error('boom')
            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error,
                } as SigningPipelineEvent)
            })

            expect(showError).toHaveBeenCalledWith(
                error,
                expect.any(String),
                expect.anything(),
            )
        })

        it('skips showError when transport is not algod (existing behavior preserved)', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'callback' },
                kind: { type: 'transactions' },
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

    describe('walletconnect transaction analytics', () => {
        const wcRequest = {
            id: 'wc1',
            sourceType: 'walletconnect',
            sourceMetadata: { name: 'Tinyman', url: 'https://tinyman.org' },
        }
        const wcPayload = {
            dapp_name: 'Tinyman',
            dapp_url: 'https://tinyman.org',
            transaction_count: 2,
        }

        const useWalletConnectRequest = () => {
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: wcRequest,
            })
            // Two transactions in the group → transaction_count: 2
            setupPipeline([], [{}, {}])
        }

        it('tracks TransactionConfirmed with the dapp payload when signing a WC request', async () => {
            useWalletConnectRequest()

            const { result } = renderHook(() => useSigningActionButtons())

            await act(async () => {
                result.current.handleSignAndSend()
            })

            expect(trackEvent).toHaveBeenCalledWith(
                'wc_transaction_confirmed',
                wcPayload,
            )
            expect(mockNext).toHaveBeenCalledTimes(1)
        })

        it('tracks TransactionDeclined when rejecting a WC request', () => {
            useWalletConnectRequest()

            const { result } = renderHook(() => useSigningActionButtons())

            act(() => {
                result.current.handleReject()
            })

            expect(trackEvent).toHaveBeenCalledWith(
                'wc_transaction_declined',
                wcPayload,
            )
            expect(mockFail).toHaveBeenCalledTimes(1)
        })

        it('tracks TransactionConfirmed only after the security guard is confirmed', async () => {
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: wcRequest,
            })
            setupPipeline(
                [
                    {
                        type: 'rekey',
                        senderAddress: 'addr1',
                        targetAddress: 'addr2',
                    },
                ],
                [{}, {}],
            )
            mockRequestBottomSheet.mockResolvedValue('confirm')

            const { result } = renderHook(() => useSigningActionButtons())

            await act(async () => {
                result.current.handleSignAndSend()
            })

            await waitFor(() => {
                expect(trackEvent).toHaveBeenCalledWith(
                    'wc_transaction_confirmed',
                    wcPayload,
                )
            })
        })

        it('does not track WC events for a local (non-walletconnect) request', () => {
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: { id: 'local1', sourceType: 'local' },
            })

            const { result } = renderHook(() => useSigningActionButtons())

            act(() => {
                result.current.handleSignAndSend()
            })
            act(() => {
                result.current.handleReject()
            })

            expect(trackEvent).not.toHaveBeenCalled()
            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockFail).toHaveBeenCalledTimes(1)
        })
    })

    describe('unsignable multisig', () => {
        // The predicate itself (cosign exclusion, signer resolution, etc.) is
        // covered by isSignRequestMultisigUnsignable's own spec; here we only
        // check the hook wires it up and blocks the send when it's true.
        const request = { id: 'r1' }

        it('blocks an unsignable multisig and does not advance the pipeline', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(true)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: request,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toEqual({
                title: 'signing.cannot_sign.title',
                body: 'signing.cannot_sign.body',
            })

            act(() => {
                result.current.handleSignAndSend()
            })

            expect(mockNext).not.toHaveBeenCalled()
        })

        it('does not block when the request is signable', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(false)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: request,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toBeUndefined()
        })

        it('reports no notice when there is no current request', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(true)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: undefined,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toBeUndefined()
        })
    })

    describe('rekeyed-unsignable senders', () => {
        const request = { id: 'r1' }

        beforeEach(() => {
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: request,
            })
        })

        it('blocks a sender rekeyed to an address outside the wallet', () => {
            ;(getRekeyedUnsignableReason as Mock).mockReturnValue({
                kind: 'authMissing',
                senderAddress: 'SND',
                authAddress: 'AUTH',
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toEqual({
                title: 'signing.cannot_sign.title',
                body: 'signing.cannot_sign.rekeyed_auth_missing_body',
            })

            act(() => {
                result.current.handleSignAndSend()
            })

            expect(mockNext).not.toHaveBeenCalled()
        })

        it('blocks a sender rekeyed to a watch-only account', () => {
            ;(getRekeyedUnsignableReason as Mock).mockReturnValue({
                kind: 'authIsWatch',
                senderAddress: 'SND',
                authAddress: 'AUTH',
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toEqual({
                title: 'signing.cannot_sign.title',
                body: 'signing.cannot_sign.rekeyed_auth_watch_body',
            })

            act(() => {
                result.current.handleSignAndSend()
            })

            expect(mockNext).not.toHaveBeenCalled()
        })

        it('shows no notice for a signable sender', () => {
            ;(getRekeyedUnsignableReason as Mock).mockReturnValue(null)

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.cannotSignNotice).toBeUndefined()
        })
    })

    describe('quantum dApp warning backstop', () => {
        const quantumRequest: { id: string; sourceType: string } = {
            id: 'q1',
            sourceType: 'walletconnect',
        }

        beforeEach(() => {
            quantumRequest.sourceType = 'walletconnect'
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: quantumRequest,
            })
        })

        it('rejects the request when the quantum dApp warning is cancelled', async () => {
            mockConfirmQuantumDappUsage.mockResolvedValue('cancel')

            const { result } = renderHook(() => useSigningActionButtons())
            await act(async () => {
                result.current.handleSignAndSend()
            })

            expect(mockFail).toHaveBeenCalledTimes(1)
            expect(mockNext).not.toHaveBeenCalled()
            expect(trackEvent).toHaveBeenCalledWith('wc_transaction_declined', {
                dapp_name: '',
                dapp_url: '',
                transaction_count: 0,
            })
        })

        it('proceeds to signing when the quantum dApp warning is confirmed', async () => {
            mockConfirmQuantumDappUsage.mockResolvedValue('continue')

            const { result } = renderHook(() => useSigningActionButtons())
            await act(async () => {
                result.current.handleSignAndSend()
            })

            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockConfirmQuantumDappUsage).toHaveBeenCalledWith([
                'QUANTUMADDRESS',
            ])
        })

        it('never consults the warning for a local sign request', async () => {
            quantumRequest.sourceType = 'local'

            const { result } = renderHook(() => useSigningActionButtons())
            await act(async () => {
                result.current.handleSignAndSend()
            })

            expect(mockConfirmQuantumDappUsage).not.toHaveBeenCalled()
            expect(mockNext).toHaveBeenCalledTimes(1)
        })
    })
})

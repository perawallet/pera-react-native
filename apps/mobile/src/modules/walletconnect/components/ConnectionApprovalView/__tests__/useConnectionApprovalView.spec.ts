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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { WalletConnectEvent, AnalyticsMetadataKey } from '@analytics'
import { AppError } from '@perawallet/wallet-core-shared'
import { useConnectionApprovalView } from '../useConnectionApprovalView'

const { trackEvent, confirmQuantumDappUsage, errorToast, showError } =
    vi.hoisted(() => ({
        trackEvent: vi.fn(),
        confirmQuantumDappUsage: vi.fn(
            async (_accounts: string[]): Promise<'continue' | 'cancel'> =>
                'continue',
        ),
        errorToast: vi.fn(),
        showError: vi.fn(),
    }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent,
}))

vi.mock('@hooks/useQuantumDappWarning', () => ({
    useQuantumDappWarning: () => ({ confirmQuantumDappUsage }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError }),
}))

const makeProposal = (overrides = {}) => ({
    kind: 'walletconnect-v1',
    proposalId: 'p1',
    peer: { name: 'Tinyman', url: 'https://tinyman.org' },
    requested: { networks: ['mainnet'], methods: ['algo_signTxn'] },
    expiresAt: Date.now() + 60_000,
    approve: vi.fn(async () => ({ id: 'c1' })),
    reject: vi.fn(async () => {}),
    ...overrides,
})

describe('useConnectionApprovalView', () => {
    beforeEach(() => {
        confirmQuantumDappUsage.mockReset().mockResolvedValue('continue')
    })

    afterEach(() => {
        trackEvent.mockClear()
        errorToast.mockClear()
        showError.mockClear()
    })

    it('approves through the proposal, with no registry lookup', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).toHaveBeenCalledWith(['AAAA'])
    })

    it('rejects through the proposal on cancel', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        await act(() => result.current.handleCancel())

        expect(proposal.reject).toHaveBeenCalled()
    })

    it('toggles account selection', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalView(makeProposal() as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        act(() => result.current.handleAccountPress('AAAA'))

        expect(result.current.selectedAccounts).toEqual([])
    })

    // The handler owns the expiry verdict and throws a typed error; a second
    // check here only lets the two answers drift.
    it('surfaces the expired error the handler throws, and settles the proposal', async () => {
        const expired = new AppError('This connection request has expired', {
            messageKey: 'errors.walletconnect.session_request_expired_body',
            retryable: false,
        })
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw expired
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        // main toasted this; the local pre-check that replaced it closed the
        // sheet silently.
        expect(showError).toHaveBeenCalledWith(expired, expect.any(String))
        // Retrying an expired handshake can only fake-succeed.
        expect(proposal.reject).toHaveBeenCalled()
    })

    it('keeps the sheet open for a retryable delivery failure', async () => {
        const timeout = new AppError("Couldn't reach WalletConnect", {
            messageKey: 'errors.walletconnect.connection_timeout_body',
            retryable: true,
        })
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw timeout
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(errorToast).toHaveBeenCalled()
        expect(proposal.reject).not.toHaveBeenCalled()
    })

    it('gates approval behind the quantum-dApp warning, before approve runs', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(confirmQuantumDappUsage).toHaveBeenCalledWith(['AAAA'])
        expect(proposal.approve).toHaveBeenCalled()
    })

    it('rejects instead of approving when the quantum warning is cancelled', async () => {
        confirmQuantumDappUsage.mockResolvedValue('cancel')
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(proposal.approve).not.toHaveBeenCalled()
        expect(proposal.reject).toHaveBeenCalled()
    })

    it('tracks a SessionApproved event on approval', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(trackEvent).toHaveBeenCalledWith(
            WalletConnectEvent.SessionApproved,
            expect.objectContaining({
                [AnalyticsMetadataKey.DappName]: 'Tinyman',
                [AnalyticsMetadataKey.DappUrl]: 'https://tinyman.org',
                [AnalyticsMetadataKey.AccountAddress]: 'AAAA',
                [AnalyticsMetadataKey.TotalAccount]: 1,
            }),
        )
    })

    it('tracks a SessionRejected event on cancel', async () => {
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        await act(() => result.current.handleCancel())

        expect(trackEvent).toHaveBeenCalledWith(
            WalletConnectEvent.SessionRejected,
            expect.objectContaining({
                [AnalyticsMetadataKey.DappName]: 'Tinyman',
                [AnalyticsMetadataKey.DappUrl]: 'https://tinyman.org',
            }),
        )
    })

    it('shows a retry toast and keeps the proposal unsettled when approve delivery fails', async () => {
        const proposal = makeProposal({
            approve: vi.fn(async () => {
                throw new Error('delivery failed')
            }),
        })
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        act(() => result.current.handleAccountPress('AAAA'))
        await act(() => result.current.handleConnect())

        expect(errorToast).toHaveBeenCalled()
        // Delivery failure is retryable: the screen must not have rejected
        // the proposal out from under the user, and the button must be
        // tappable again.
        expect(proposal.reject).not.toHaveBeenCalled()
        expect(result.current.isConnecting).toBe(false)
    })

    it('ignores a second Cancel tap while the first reject is still in flight', async () => {
        const proposal = makeProposal()
        let resolveReject: () => void = () => {}
        proposal.reject = vi.fn(
            () =>
                new Promise<void>(resolve => {
                    resolveReject = resolve
                }),
        )
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )

        let firstCall!: Promise<void>
        let secondCall!: Promise<void>
        act(() => {
            firstCall = result.current.handleCancel()
            secondCall = result.current.handleCancel()
        })
        resolveReject()
        await act(async () => {
            await Promise.all([firstCall, secondCall])
        })

        // A double-tapped Cancel (nothing disables the button while a
        // reject is in flight) must reach `proposal.reject` once, not
        // twice — a second call here is exactly what fed
        // `useConnectionsProvider`'s stale-settle bug.
        expect(proposal.reject).toHaveBeenCalledTimes(1)
    })

    it('ignores a second Connect tap while the quantum warning is still pending', async () => {
        let resolveDecision: (
            decision: 'continue' | 'cancel',
        ) => void = () => {}
        confirmQuantumDappUsage.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveDecision = resolve
                }),
        )
        const proposal = makeProposal()
        const { result } = renderHook(() =>
            useConnectionApprovalView(proposal as never),
        )
        act(() => result.current.handleAccountPress('AAAA'))

        let firstCall!: Promise<void>
        let secondCall!: Promise<void>
        act(() => {
            firstCall = result.current.handleConnect()
            secondCall = result.current.handleConnect()
        })
        resolveDecision('continue')
        await act(async () => {
            await Promise.all([firstCall, secondCall])
        })

        // `isConnecting` doesn't flip true until AFTER the quantum-warning
        // await resolves, so `isLoading`/`isDisabled` alone can't stop a
        // second tap landing during that gap — this is what closes it.
        expect(confirmQuantumDappUsage).toHaveBeenCalledTimes(1)
        expect(proposal.approve).toHaveBeenCalledTimes(1)
    })
})

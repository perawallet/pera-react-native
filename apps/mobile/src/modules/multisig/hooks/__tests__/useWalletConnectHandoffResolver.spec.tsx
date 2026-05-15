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

import React from 'react'
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AppState, type AppStateStatus } from 'react-native'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({
    getSignRequestsWithSignatures: vi.fn(),
    classifyHandoffPoll: vi.fn(),
    resolveHandoffOutcome: vi.fn(),
    markConfirmed: vi.fn(),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-native', () => ({
    AppState: {
        currentState: 'active',
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    getSignRequestsWithSignatures: mocks.getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey: (
        network: string,
        signRequestId: string,
    ) => ['multisig', 'sign-request-with-signatures', network, signRequestId],
    useMarkSignRequestsConfirmedMutation: () => ({
        markConfirmed: mocks.markConfirmed,
        isPending: false,
    }),
}))

// The classification / delivery logic has its own spec; stub it here so this
// suite verifies only the poll → classify → resolve wiring.
vi.mock('../../utils/classifyHandoffPoll', () => ({
    classifyHandoffPoll: mocks.classifyHandoffPoll,
    resolveHandoffOutcome: mocks.resolveHandoffOutcome,
}))

import { useWalletConnectHandoffResolver } from '../useWalletConnectHandoffResolver'

const makeHandoff = (signRequestId: string): PendingWalletConnectHandoff => ({
    signRequestId,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B', 'C'] },
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {},
    source: { type: 'walletconnect' },
    registeredAt: Date.now(),
})

const setAppState = (state: AppStateStatus): void => {
    ;(AppState as { currentState: AppStateStatus }).currentState = state
}

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('useWalletConnectHandoffResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setAppState('active')
        ;(AppState.addEventListener as Mock).mockImplementation(() => ({
            remove: vi.fn(),
        }))
        walletConnectHandoffs.__resetForTests()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mocks.getSignRequestsWithSignatures.mockResolvedValue([{ id: 'sr-1' }])
        mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })
        mocks.resolveHandoffOutcome.mockResolvedValue(undefined)
    })

    afterEach(() => {
        queryClient.clear()
    })

    it('polls each registered handoff', async () => {
        mocks.getSignRequestsWithSignatures.mockImplementation(
            (
                _network: string,
                params: { proposed_sign_request_ids: string[] },
            ) => Promise.resolve([{ id: params.proposed_sign_request_ids[0] }]),
        )
        walletConnectHandoffs.register(makeHandoff('sr-1'))
        walletConnectHandoffs.register(makeHandoff('sr-2'))

        renderHook(() => useWalletConnectHandoffResolver(), { wrapper })

        await waitFor(() => {
            const polledIds =
                mocks.getSignRequestsWithSignatures.mock.calls.map(
                    call => call[1].proposed_sign_request_ids[0],
                )
            expect(polledIds).toContain('sr-1')
            expect(polledIds).toContain('sr-2')
        })
    })

    it('delivers a terminal outcome to resolveHandoffOutcome', async () => {
        const outcome = { kind: 'soft-reject', reason: 'declined' }
        mocks.classifyHandoffPoll.mockReturnValue(outcome)
        const handoff = makeHandoff('sr-1')
        walletConnectHandoffs.register(handoff)

        renderHook(() => useWalletConnectHandoffResolver(), { wrapper })

        await waitFor(() =>
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
        )
        expect(mocks.resolveHandoffOutcome).toHaveBeenCalledWith({
            outcome,
            handoff,
            messages: expect.objectContaining({
                declined: 'multisig.sync_sign.errors.declined',
            }),
            markConfirmed: mocks.markConfirmed,
        })
    })

    it('does not deliver while the poll says keep-polling', async () => {
        mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })
        walletConnectHandoffs.register(makeHandoff('sr-1'))

        renderHook(() => useWalletConnectHandoffResolver(), { wrapper })

        await waitFor(() =>
            expect(mocks.classifyHandoffPoll).toHaveBeenCalled(),
        )
        expect(mocks.resolveHandoffOutcome).not.toHaveBeenCalled()
    })

    it('does not poll while the app is backgrounded', async () => {
        setAppState('background')
        walletConnectHandoffs.register(makeHandoff('sr-1'))

        renderHook(() => useWalletConnectHandoffResolver(), { wrapper })

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(mocks.getSignRequestsWithSignatures).not.toHaveBeenCalled()
    })

    it('starts polling a handoff registered after mount', async () => {
        renderHook(() => useWalletConnectHandoffResolver(), { wrapper })
        expect(mocks.getSignRequestsWithSignatures).not.toHaveBeenCalled()

        act(() => {
            walletConnectHandoffs.register(makeHandoff('sr-1'))
        })

        await waitFor(() =>
            expect(mocks.getSignRequestsWithSignatures).toHaveBeenCalled(),
        )
    })

    it('delivers each terminal outcome only once across repeated polls', async () => {
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'soft-reject',
            reason: 'declined',
        })
        walletConnectHandoffs.register(makeHandoff('sr-1'))
        vi.useFakeTimers()
        try {
            renderHook(() => useWalletConnectHandoffResolver(), { wrapper })

            await vi.waitFor(() =>
                expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
            )

            // A second poll cycle must not re-deliver — the resolved guard holds.
            await vi.advanceTimersByTimeAsync(3000)
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})

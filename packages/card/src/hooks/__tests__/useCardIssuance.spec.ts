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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchCardStatus, orderCard } = vi.hoisted(() => ({
    fetchCardStatus: vi.fn(),
    orderCard: vi.fn(),
}))
vi.mock('../../api/card', async () => ({
    ...(await vi.importActual('../../api/card')),
    fetchCardStatus,
    orderCard,
}))

const { fetchUser } = vi.hoisted(() => ({ fetchUser: vi.fn() }))
vi.mock('../../api/user', async () => ({
    ...(await vi.importActual('../../api/user')),
    fetchUser,
}))

import { useCardIssuance, CardIssuanceState } from '../useCardIssuance'
import { CardStatus, CardType, VerificationState } from '../../models'
import type { Card } from '../../models'

const ACTIVE_CARD: Card = {
    id: 'card-1',
    panLast4: '2234',
    status: CardStatus.Active,
    type: CardType.Virtual,
    orderedAt: '2026-07-29T10:00:00Z',
}

const user = (verificationState: VerificationState) => ({
    id: 'baanx-user-1',
    verificationState,
})

/** A ky-shaped rejection whose body getCardApiError can read. */
const baanxError = (status: number, body: Record<string, unknown>) => ({
    data: body,
    response: { status },
})

describe('useCardIssuance', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('auto-orders exactly once when VERIFIED with no card, then lands READY once the refetched status shows the card', async () => {
        let isOrdered = false
        fetchCardStatus.mockImplementation(async () =>
            isOrdered ? ACTIVE_CARD : null,
        )
        fetchUser.mockResolvedValue(user(VerificationState.Verified))
        orderCard.mockImplementation(async () => {
            isOrdered = true
        })

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(CardIssuanceState.Ready),
        )
        expect(orderCard).toHaveBeenCalledTimes(1)
    })

    it('two instances mounted in the same commit share a single order attempt', async () => {
        let isOrdered = false
        fetchCardStatus.mockImplementation(async () =>
            isOrdered ? ACTIVE_CARD : null,
        )
        fetchUser.mockResolvedValue(user(VerificationState.Verified))
        orderCard.mockImplementation(async () => {
            isOrdered = true
        })

        const { result } = renderHook(
            () => ({ first: useCardIssuance(), second: useCardIssuance() }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.first.state).toBe(CardIssuanceState.Ready),
        )
        expect(result.current.second.state).toBe(CardIssuanceState.Ready)
        expect(orderCard).toHaveBeenCalledTimes(1)
    })

    it('waits without ordering while verification is PENDING', async () => {
        fetchCardStatus.mockResolvedValue(null)
        fetchUser.mockResolvedValue(user(VerificationState.Pending))

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(
                CardIssuanceState.VerificationPending,
            ),
        )
        expect(orderCard).not.toHaveBeenCalled()
    })

    it('REJECTED verification is terminal and never orders', async () => {
        fetchCardStatus.mockResolvedValue(null)
        fetchUser.mockResolvedValue(user(VerificationState.Rejected))

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(
                CardIssuanceState.VerificationRejected,
            ),
        )
        expect(orderCard).not.toHaveBeenCalled()
    })

    it('a not-verified refusal falls back to the pending view, refreshes the user cache, and does not re-fire in the same verified window', async () => {
        fetchCardStatus.mockResolvedValue(null)
        // The cached VERIFIED is stale: the order endpoint keeps refusing.
        fetchUser.mockResolvedValue(user(VerificationState.Verified))
        orderCard.mockRejectedValue(
            baanxError(403, { message: 'Account has not been verified' }),
        )

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(
                CardIssuanceState.VerificationPending,
            ),
        )
        // The refusal invalidated the user query (initial fetch + refetch).
        await waitFor(() =>
            expect(fetchUser.mock.calls.length).toBeGreaterThanOrEqual(2),
        )
        expect(orderCard).toHaveBeenCalledTimes(1)
        // Still VERIFIED in cache, still no card: the window's attempt is
        // spent, so no storm of retries.
        expect(result.current.state).toBe(CardIssuanceState.VerificationPending)
    })

    it('a real order failure surfaces ORDER_FAILED and retryOrder fires a fresh attempt', async () => {
        let isOrdered = false
        fetchCardStatus.mockImplementation(async () =>
            isOrdered ? ACTIVE_CARD : null,
        )
        fetchUser.mockResolvedValue(user(VerificationState.Verified))
        orderCard.mockRejectedValueOnce(
            baanxError(500, { message: 'Internal error' }),
        )
        orderCard.mockImplementation(async () => {
            isOrdered = true
        })

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(CardIssuanceState.OrderFailed),
        )

        result.current.retryOrder()

        await waitFor(() =>
            expect(result.current.state).toBe(CardIssuanceState.Ready),
        )
        expect(orderCard).toHaveBeenCalledTimes(2)
    })

    it('an existing card is READY and the dashboard never fetches the user', async () => {
        fetchCardStatus.mockResolvedValue(ACTIVE_CARD)

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(CardIssuanceState.Ready),
        )
        expect(fetchUser).not.toHaveBeenCalled()
        expect(orderCard).not.toHaveBeenCalled()
    })

    it('a provisioning (PENDING) card reports ISSUING', async () => {
        fetchCardStatus.mockResolvedValue({
            ...ACTIVE_CARD,
            status: CardStatus.Pending,
        })

        const { result } = renderHook(() => useCardIssuance(), { wrapper })

        await waitFor(() =>
            expect(result.current.state).toBe(CardIssuanceState.Issuing),
        )
        expect(orderCard).not.toHaveBeenCalled()
    })
})

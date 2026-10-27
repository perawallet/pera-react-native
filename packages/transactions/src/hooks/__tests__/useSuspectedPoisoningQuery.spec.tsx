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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    detectSuspectedPoisoning,
    findImitatedAddress,
    type KnownAddress,
    type SuspectableEntry,
} from '../../address-safety'
import { useSuspectedPoisoningQuery } from '../useSuspectedPoisoningQuery'

vi.mock('../../address-safety', () => ({
    detectSuspectedPoisoning: vi.fn(),
    findImitatedAddress: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const CONTACT: KnownAddress = {
    address: 'CONTACT',
    source: 'contact',
    name: 'Alice',
}

const entry = (id: string, counterparty: string): SuspectableEntry => ({
    id,
    summary: {
        kind: 'transfer',
        title: { key: 'title' },
        direction: 'in',
        counterparty,
        icon: 'receive',
    } as TransactionSummary,
})

const LOOK_ALIKE = entry('tx-look-alike', 'LOOK-ALIKE')
const REAL = entry('tx-real', 'FRIEND')

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

describe('useSuspectedPoisoningQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient()
        vi.mocked(findImitatedAddress).mockImplementation(({ entry }) =>
            entry.summary.counterparty === 'LOOK-ALIKE' ? CONTACT : undefined,
        )
    })

    const render = (
        entries: SuspectableEntry[],
        knownAddresses: KnownAddress[] = [CONTACT],
    ) =>
        renderHook(
            () =>
                useSuspectedPoisoningQuery({
                    entries,
                    accountAddress: 'ME',
                    scope: SCOPE,
                    knownAddresses,
                }),
            { wrapper: wrapper(queryClient) },
        )

    it('checks only the look-alikes and keys the result by transaction id', async () => {
        const suspected = {
            transactionId: LOOK_ALIKE.id,
            counterparty: 'LOOK-ALIKE',
            imitates: CONTACT,
        }
        vi.mocked(detectSuspectedPoisoning).mockResolvedValue([suspected])

        const { result } = render([REAL, LOOK_ALIKE])

        await waitFor(() =>
            expect(result.current.data.get(LOOK_ALIKE.id)).toEqual(suspected),
        )
        expect(result.current.data.has(REAL.id)).toBe(false)
        expect(detectSuspectedPoisoning).toHaveBeenCalledWith(
            expect.objectContaining({ entries: [LOOK_ALIKE] }),
        )
    })

    it('runs no query when no entry resembles a known address', () => {
        const { result } = render([REAL])

        expect(result.current.data.size).toBe(0)
        expect(detectSuspectedPoisoning).not.toHaveBeenCalled()
    })

    it('drops the marker once the imitated address is no longer known', async () => {
        vi.mocked(detectSuspectedPoisoning).mockResolvedValue([
            {
                transactionId: LOOK_ALIKE.id,
                counterparty: 'LOOK-ALIKE',
                imitates: CONTACT,
            },
        ])
        const { result, rerender } = renderHook(
            ({ knownAddresses }) =>
                useSuspectedPoisoningQuery({
                    entries: [LOOK_ALIKE],
                    accountAddress: 'ME',
                    scope: SCOPE,
                    knownAddresses,
                }),
            {
                wrapper: wrapper(queryClient),
                initialProps: { knownAddresses: [CONTACT] },
            },
        )
        await waitFor(() => expect(result.current.data.size).toBe(1))

        vi.mocked(findImitatedAddress).mockReturnValue(undefined)
        rerender({ knownAddresses: [] })

        expect(result.current.data.size).toBe(0)
    })

    it('returns nothing when the check fails', async () => {
        vi.mocked(detectSuspectedPoisoning).mockRejectedValue(
            new Error('offline'),
        )

        const { result } = render([LOOK_ALIKE])

        await waitFor(() => expect(detectSuspectedPoisoning).toHaveBeenCalled())
        expect(result.current.data.size).toBe(0)
    })
})

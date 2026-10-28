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

// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { fetchTrustedCounterparties } from '../../address-safety'
import { fakeCodec } from '../../address-safety/__tests__/fakeCodecs'
import {
    TRUSTED_COUNTERPARTIES_DEADLINE_MS,
    useTrustedCounterpartiesQuery,
} from '../useTrustedCounterpartiesQuery'

vi.mock('../../address-safety', () => ({
    fetchTrustedCounterparties: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

const paid = (address: string) => ({ address, hasBeenPaid: true })
const never = () => new Promise<never>(() => {})

describe('useTrustedCounterpartiesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        addressCodecs.reset()
        addressCodecs.register(fakeCodec('ethereum', { isCaseBlind: true }))
        onlineManager.setOnline(true)
        queryClient = new QueryClient()
    })

    const render = (
        accountAddresses: string[],
        {
            senderAddress = accountAddresses[0],
            isEnabled,
        }: { senderAddress?: string; isEnabled?: boolean } = {},
    ) =>
        renderHook(
            () =>
                useTrustedCounterpartiesQuery({
                    senderAddress,
                    accountAddresses,
                    scope: SCOPE,
                    isEnabled,
                }),
            { wrapper: wrapper(queryClient) },
        )

    it('joins the counterparties of every account', async () => {
        vi.mocked(fetchTrustedCounterparties).mockImplementation(
            async ({ accountAddress }) => [paid(`${accountAddress}-PAYEE`)],
        )

        const { result } = render(['A', 'B'])

        await waitFor(() => expect(result.current.data).toHaveLength(2))
        expect(result.current.data).toEqual([paid('A-PAYEE'), paid('B-PAYEE')])
    })

    it("is pending while the sender's history loads", () => {
        vi.mocked(fetchTrustedCounterparties).mockImplementation(never)

        const { result } = render(['A', 'B'], { senderAddress: 'A' })

        expect(result.current.isPending).toBe(true)
    })

    it('does not wait on a slow account other than the sender', async () => {
        vi.mocked(fetchTrustedCounterparties).mockImplementation(
            ({ accountAddress }) =>
                accountAddress === 'SENDER'
                    ? Promise.resolve([paid('SENDER-PAYEE')])
                    : never(),
        )

        const { result } = render(['SLOW', 'SENDER'], {
            senderAddress: 'sender',
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([paid('SENDER-PAYEE')])
    })

    it("adds another account's counterparties once they land", async () => {
        let release: (
            value: { address: string; hasBeenPaid: boolean }[],
        ) => void = () => {}
        vi.mocked(fetchTrustedCounterparties).mockImplementation(
            ({ accountAddress }) =>
                accountAddress === 'SENDER'
                    ? Promise.resolve([])
                    : new Promise(resolve => {
                          release = resolve
                      }),
        )

        const { result } = render(['SENDER', 'OTHER'])
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([])

        release([paid('OTHER-PAYEE')])

        await waitFor(() =>
            expect(result.current.data).toEqual([paid('OTHER-PAYEE')]),
        )
    })

    it("settles when the sender's history fails", async () => {
        vi.mocked(fetchTrustedCounterparties).mockImplementation(
            async ({ accountAddress }) => {
                if (accountAddress === 'A') throw new Error('history down')
                return [paid('B-PAYEE')]
            },
        )

        const { result } = render(['A', 'B'])

        await waitFor(() => expect(result.current.isPending).toBe(false))
        await waitFor(() =>
            expect(result.current.data).toEqual([paid('B-PAYEE')]),
        )
    })

    it("reports that the sender's history loaded", async () => {
        vi.mocked(fetchTrustedCounterparties).mockResolvedValue([])

        const { result } = render(['A'])

        await waitFor(() => expect(result.current.hasSenderHistory).toBe(true))
    })

    it("reports no sender history when the sender's read fails", async () => {
        vi.mocked(fetchTrustedCounterparties).mockImplementation(
            async ({ accountAddress }) => {
                if (accountAddress === 'A') throw new Error('history down')
                return []
            },
        )

        const { result } = render(['A', 'B'])

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.hasSenderHistory).toBe(false)
    })

    describe('with a deadline', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true })
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it("stops holding Confirm once the sender's read runs past the deadline", async () => {
            let readSignal: AbortSignal | undefined
            vi.mocked(fetchTrustedCounterparties).mockImplementation(
                ({ signal }) => {
                    readSignal = signal
                    return never()
                },
            )

            const { result } = render(['A'])
            expect(result.current.isPending).toBe(true)

            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    TRUSTED_COUNTERPARTIES_DEADLINE_MS,
                )
            })

            await waitFor(() => expect(result.current.isPending).toBe(false))
            expect(result.current.hasSenderHistory).toBe(false)
            expect(readSignal?.aborted).toBe(true)
        })
    })

    it('does not wait on history while offline', () => {
        onlineManager.setOnline(false)

        const { result } = render(['A'])

        expect(result.current.isPending).toBe(false)
        expect(result.current.hasSenderHistory).toBe(false)
        expect(result.current.data).toEqual([])
        expect(fetchTrustedCounterparties).not.toHaveBeenCalled()
    })

    it('neither fetches nor waits when disabled', () => {
        const { result } = render(['A'], { isEnabled: false })

        expect(result.current.isPending).toBe(false)
        expect(fetchTrustedCounterparties).not.toHaveBeenCalled()
    })
})

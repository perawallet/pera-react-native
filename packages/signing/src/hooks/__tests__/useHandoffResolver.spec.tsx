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
import type { Network } from '@perawallet/wallet-core-shared'
import {
    useHandoffResolver,
    type HandoffPollDescriptor,
} from '../useHandoffResolver'

const mocks = vi.hoisted(() => ({ useQueries: vi.fn() }))
vi.mock('@tanstack/react-query', () => ({ useQueries: mocks.useQueries }))

type Item = { signRequestId: string; network: Network }
type Detail = { id: string }

type CapturedQuery = HandoffPollDescriptor<Detail[], Detail> & {
    staleTime: number
    gcTime: number
    refetchInterval: (q: { state: { status: string } }) => number
}

// Capture the query descriptors the hook hands to `useQueries`, and control the
// poll results it reads back.
let lastQueries: CapturedQuery[] = []
let nextResults: { data: Detail | undefined }[] = []

const makeItem = (overrides: Partial<Item> = {}): Item => ({
    signRequestId: 'req-1',
    network: 'mainnet',
    ...overrides,
})

const poll = (item: Item): HandoffPollDescriptor<Detail[], Detail> => ({
    queryKey: ['msig', item.network, item.signRequestId],
    queryFn: () => Promise.resolve([{ id: item.signRequestId }]),
    select: (data: Detail[]) => data.find(d => d.id === item.signRequestId),
    enabled: true,
})

const classify = vi.fn()
const resolve = vi.fn()

type Args = Parameters<typeof useHandoffResolver<Item, Detail[], Detail>>[0]

const baseArgs = (overrides: Partial<Args> = {}): Args => ({
    handoffs: [makeItem()],
    keyOf: item => item.signRequestId,
    poll,
    classify,
    resolve,
    ...overrides,
})

const render = (overrides: Partial<Args> = {}) =>
    renderHook(props => useHandoffResolver(props), {
        initialProps: baseArgs(overrides),
    })

beforeEach(() => {
    vi.clearAllMocks()
    lastQueries = []
    nextResults = []
    classify.mockReturnValue({ kind: 'keep-polling' })
    resolve.mockReturnValue(undefined)
    mocks.useQueries.mockImplementation((arg: { queries: CapturedQuery[] }) => {
        lastQueries = arg.queries
        return nextResults
    })
})

describe('useHandoffResolver', () => {
    it('builds one query per handoff from the supplied poll descriptor', () => {
        render({
            handoffs: [
                makeItem({ signRequestId: 'a' }),
                makeItem({ signRequestId: 'b' }),
            ],
        })

        expect(lastQueries).toHaveLength(2)
        expect(lastQueries[0].queryKey).toEqual(['msig', 'mainnet', 'a'])
        expect(lastQueries[1].queryKey).toEqual(['msig', 'mainnet', 'b'])
        expect(lastQueries[0].enabled).toBe(true)
    })

    it('injects the two-tier backoff cadence and a no-cache policy', () => {
        render()

        expect(
            lastQueries[0].refetchInterval({ state: { status: 'error' } }),
        ).toBe(30_000)
        expect(
            lastQueries[0].refetchInterval({ state: { status: 'success' } }),
        ).toBe(3000)
        expect(lastQueries[0].staleTime).toBe(0)
        expect(lastQueries[0].gcTime).toBe(0)
    })

    it('drives every handoff on its own network when no active-network filter is set', () => {
        render({
            handoffs: [
                makeItem({ signRequestId: 'a', network: 'mainnet' }),
                makeItem({ signRequestId: 'b', network: 'testnet' }),
            ],
        })

        expect(lastQueries).toHaveLength(2)
    })

    it('drives only active-network handoffs when the filter is opted into', async () => {
        nextResults = [{ data: { id: 'a' } }]
        classify.mockReturnValue({ kind: 'soft-reject', reason: 'declined' })

        render({
            handoffs: [
                makeItem({ signRequestId: 'a', network: 'mainnet' }),
                makeItem({ signRequestId: 'b', network: 'testnet' }),
            ],
            activeNetwork: 'mainnet',
            networkOf: item => item.network,
        })

        // Only the mainnet handoff produces a query and gets resolved.
        expect(lastQueries).toHaveLength(1)
        expect(lastQueries[0].queryKey).toEqual(['msig', 'mainnet', 'a'])
        await waitFor(() => {
            expect(resolve).toHaveBeenCalledTimes(1)
        })
        expect(resolve.mock.calls[0][1]).toMatchObject({ signRequestId: 'a' })
    })

    it('resolves a terminal outcome once, passing the item and the poll detail', async () => {
        const item = makeItem()
        const detail = { id: 'req-1' }
        const outcome = { kind: 'ready', assembledBytes: [] }
        nextResults = [{ data: detail }]
        classify.mockReturnValue(outcome)

        render({ handoffs: [item] })

        expect(classify).toHaveBeenCalledWith(detail, item)
        await waitFor(() => {
            expect(resolve).toHaveBeenCalledTimes(1)
        })
        expect(resolve).toHaveBeenCalledWith(outcome, item, detail)
    })

    it('does not resolve while the outcome is non-terminal', async () => {
        nextResults = [{ data: { id: 'req-1' } }]
        classify.mockReturnValue({ kind: 'keep-polling' })

        render()

        // `resolve` is dispatched from a microtask after `classify` settles, so
        // asserting synchronously here would pass for a terminal outcome too.
        await waitFor(() => {
            expect(classify).toHaveBeenCalledTimes(1)
        })
        await Promise.resolve()
        expect(resolve).not.toHaveBeenCalled()
    })

    it('skips a handoff whose poll has no result yet, and never classifies it', () => {
        nextResults = [{ data: undefined }]

        render()

        expect(classify).not.toHaveBeenCalled()
        expect(resolve).not.toHaveBeenCalled()
    })

    it('does not re-resolve the same handoff on a later re-render', async () => {
        const item = makeItem()
        classify.mockReturnValue({ kind: 'ready', assembledBytes: [] })
        // Fresh result-array references force the effect to re-run each render.
        mocks.useQueries
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })

        const { rerender } = render({ handoffs: [item] })
        rerender(baseArgs({ handoffs: [item] }))

        await waitFor(() => {
            expect(resolve).toHaveBeenCalledTimes(1)
        })
        // Settle any second in-flight classification: the claim is taken before
        // the await, so the re-render must not produce a second resolve.
        await Promise.resolve()
        expect(resolve).toHaveBeenCalledTimes(1)
    })

    // The claim is taken before classification, so both non-terminal exits have
    // to hand it back — otherwise the `has(key)` guard short-circuits every
    // later poll and the handoff never resolves at all.
    it('resolves on a later poll after a keep-polling outcome handed the claim back', async () => {
        const item = makeItem()
        classify
            .mockReturnValueOnce({ kind: 'keep-polling' })
            .mockReturnValueOnce({ kind: 'ready', assembledBytes: [] })
        mocks.useQueries
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })

        const { rerender } = render({ handoffs: [item] })
        await waitFor(() => {
            expect(classify).toHaveBeenCalledTimes(1)
        })
        rerender(baseArgs({ handoffs: [item] }))

        await waitFor(() => {
            expect(resolve).toHaveBeenCalledTimes(1)
        })
    })

    it('resolves on a later poll after classification threw', async () => {
        const item = makeItem()
        classify
            .mockRejectedValueOnce(new Error('transient'))
            .mockReturnValueOnce({ kind: 'ready', assembledBytes: [] })
        mocks.useQueries
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })
            .mockImplementationOnce((arg: { queries: CapturedQuery[] }) => {
                lastQueries = arg.queries
                return [{ data: { id: 'req-1' } }]
            })

        const { rerender } = render({ handoffs: [item] })
        await waitFor(() => {
            expect(classify).toHaveBeenCalledTimes(1)
        })
        rerender(baseArgs({ handoffs: [item] }))

        await waitFor(() => {
            expect(resolve).toHaveBeenCalledTimes(1)
        })
    })
})

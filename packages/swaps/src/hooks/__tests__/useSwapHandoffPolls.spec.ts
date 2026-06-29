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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { SwapHandoffRecord } from '../../models'
import { useSwapHandoffPolls } from '../useSwapHandoffPolls'

const mocks = vi.hoisted(() => ({
    useQueries: vi.fn(),
    getSignRequestsWithSignatures: vi.fn(),
    getSignRequestsWithSignaturesQueryKey: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({ useQueries: mocks.useQueries }))
vi.mock('@perawallet/wallet-core-multisig', () => ({
    getSignRequestsWithSignatures: mocks.getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey:
        mocks.getSignRequestsWithSignaturesQueryKey,
}))

type CapturedQuery = {
    queryKey: unknown
    queryFn: () => unknown
    select: (data: { id: string }[]) => unknown
    enabled: boolean
    refetchInterval: (q: { state: { status: string } }) => number
}

// Captures the query descriptors the hook hands to `useQueries` so we can probe
// the per-query config (enabled gate, backoff cadence, select) directly.
let lastQueries: CapturedQuery[] = []
let nextResults: { data: unknown }[] = []

const makeRecord = (
    overrides: Partial<SwapHandoffRecord> = {},
): SwapHandoffRecord => ({
    swapIdStr: '42',
    signRequestId: 'req-1',
    network: 'mainnet',
    multisigAddress: 'JOINT_ADDR',
    deviceId: 'device-1',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
    plan: [],
    expectedRawTransactionsBase64: ['cmF3'],
    registeredAt: 1,
    ...overrides,
})

const render = (args: Parameters<typeof useSwapHandoffPolls>[0]) =>
    renderHook(() => useSwapHandoffPolls(args))

beforeEach(() => {
    vi.clearAllMocks()
    lastQueries = []
    nextResults = []
    mocks.getSignRequestsWithSignaturesQueryKey.mockImplementation(
        (network: string, id: string) => ['msig', network, id],
    )
    mocks.useQueries.mockImplementation((arg: { queries: CapturedQuery[] }) => {
        lastQueries = arg.queries
        return nextResults
    })
})

describe('swaps/useSwapHandoffPolls', () => {
    it('builds no queries when there are no handoffs', () => {
        const { result } = render({
            handoffs: [],
            deviceId: 'device-1',
            isAppActive: true,
        })

        expect(lastQueries).toEqual([])
        expect(result.current).toEqual([])
    })

    it('builds one query per handoff keyed by network + sign-request id', () => {
        render({
            handoffs: [
                makeRecord({ signRequestId: 'a' }),
                makeRecord({ signRequestId: 'b' }),
            ],
            deviceId: 'device-1',
            isAppActive: true,
        })

        expect(lastQueries).toHaveLength(2)
        expect(lastQueries[0].queryKey).toEqual(['msig', 'mainnet', 'a'])
        expect(lastQueries[1].queryKey).toEqual(['msig', 'mainnet', 'b'])
    })

    it('enables polling only when foregrounded and a device id is present', () => {
        const handoffs = [makeRecord()]

        render({ handoffs, deviceId: 'device-1', isAppActive: true })
        expect(lastQueries[0].enabled).toBe(true)

        render({ handoffs, deviceId: 'device-1', isAppActive: false })
        expect(lastQueries[0].enabled).toBe(false)

        render({ handoffs, deviceId: null, isAppActive: true })
        expect(lastQueries[0].enabled).toBe(false)
    })

    it('backs the cadence off after a failed poll', () => {
        render({
            handoffs: [makeRecord()],
            deviceId: 'device-1',
            isAppActive: true,
        })

        expect(
            lastQueries[0].refetchInterval({ state: { status: 'error' } }),
        ).toBe(30_000)
        expect(
            lastQueries[0].refetchInterval({ state: { status: 'success' } }),
        ).toBe(3000)
    })

    it('requests with-signatures for the handoff and selects the matching id', () => {
        render({
            handoffs: [makeRecord({ signRequestId: 'req-1' })],
            deviceId: 'device-1',
            isAppActive: true,
        })

        lastQueries[0].queryFn()
        expect(mocks.getSignRequestsWithSignatures).toHaveBeenCalledWith(
            'mainnet',
            { device_id: 'device-1', proposed_sign_request_ids: ['req-1'] },
        )

        const match = { id: 'req-1' }
        expect(lastQueries[0].select([{ id: 'other' }, match])).toBe(match)
    })

    it('falls back to an empty device id in the request when none is set', () => {
        render({
            handoffs: [makeRecord()],
            deviceId: null,
            isAppActive: true,
        })

        lastQueries[0].queryFn()
        expect(mocks.getSignRequestsWithSignatures).toHaveBeenCalledWith(
            'mainnet',
            expect.objectContaining({ device_id: '' }),
        )
    })

    it('pairs each handoff with the latest poll result by index', () => {
        const handoffs = [
            makeRecord({ signRequestId: 'a' }),
            makeRecord({ signRequestId: 'b' }),
        ]
        const detailA = { id: 'a' }
        nextResults = [{ data: detailA }, { data: undefined }]

        const { result } = render({
            handoffs,
            deviceId: 'device-1',
            isAppActive: true,
        })

        expect(result.current).toEqual([
            { handoff: handoffs[0], detail: detailA },
            { handoff: handoffs[1], detail: undefined },
        ])
    })
})

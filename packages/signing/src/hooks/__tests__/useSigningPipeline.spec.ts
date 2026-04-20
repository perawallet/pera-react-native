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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TransactionSignRequest } from '../../models'

const mockSigningRequest = {
    currentRequest: undefined as unknown,
    currentActorRef: null as unknown,
    signAndSendRequest: vi.fn(),
    rejectRequest: vi.fn(),
    retryRequest: vi.fn(),
}

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => mockSigningRequest,
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => [
            { address: 'ADDR_A', type: 'algo25' },
            { address: 'ADDR_B', type: 'algo25' },
        ],
        canSignWithAccount: () => true,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        mapToDisplayableTransaction: (tx: unknown) => tx,
    }
})

import { useSigningPipeline } from '../useSigningPipeline'

beforeEach(() => {
    mockSigningRequest.currentRequest = undefined
    mockSigningRequest.currentActorRef = null
    mockSigningRequest.signAndSendRequest.mockReset()
    mockSigningRequest.rejectRequest.mockReset()
    mockSigningRequest.retryRequest.mockReset()
})

describe('useSigningPipeline', () => {
    test('returns empty data when there is no current request', () => {
        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.currentRequest).toBeUndefined()
        expect(result.current.stage).toBe('idle')
        expect(result.current.allTransactions).toEqual([])
        expect(result.current.listItems).toEqual([])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isRetryable).toBe(false)
    })

    test('next, fail, retry are no-ops with no request', () => {
        const { result } = renderHook(() => useSigningPipeline())
        result.current.next()
        result.current.fail()
        result.current.retry()
        expect(mockSigningRequest.signAndSendRequest).not.toHaveBeenCalled()
        expect(mockSigningRequest.rejectRequest).not.toHaveBeenCalled()
        expect(mockSigningRequest.retryRequest).not.toHaveBeenCalled()
    })

    test('next, fail, retry forward to useSigningRequest when request exists', () => {
        const request = {
            id: 'req-1',
            type: 'arbitrary-data',
            data: [],
        } as unknown
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        act(() => {
            result.current.next()
            result.current.fail()
            result.current.retry()
        })

        expect(mockSigningRequest.signAndSendRequest).toHaveBeenCalledWith(
            request,
        )
        expect(mockSigningRequest.rejectRequest).toHaveBeenCalledWith(request)
        expect(mockSigningRequest.retryRequest).toHaveBeenCalledWith(request)
    })

    test('computes display data for transaction requests', () => {
        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
            ],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        // `allTransactions` comes from mapToDisplayableTransaction which passes through
        expect(result.current.allTransactions).toHaveLength(1)
        expect(result.current.signableAddresses.size).toBeGreaterThan(0)
    })

    test('subscribes to actor ref and derives stage from snapshot', () => {
        const subscriberCalls: Array<(s: unknown) => void> = []
        const actorRef = {
            subscribe: (cb: (s: unknown) => void) => {
                subscriberCalls.push(cb)
                return { unsubscribe: vi.fn() }
            },
        }
        mockSigningRequest.currentActorRef = actorRef

        const onEvent = vi.fn()
        const { result } = renderHook(() => useSigningPipeline({ onEvent }))

        // push a rejected snapshot
        act(() => {
            subscriberCalls[0]({
                matches: (s: string) => s === 'rejected',
                context: { error: null },
            })
        })

        expect(result.current.stage).toBe('rejected')
        expect(onEvent).toHaveBeenCalledWith({ type: 'signing_rejected' })
    })

    test('isLoading is true during signing stage', () => {
        const subscriberCalls: Array<(s: unknown) => void> = []
        mockSigningRequest.currentActorRef = {
            subscribe: (cb: (s: unknown) => void) => {
                subscriberCalls.push(cb)
                return { unsubscribe: vi.fn() }
            },
        }
        const { result } = renderHook(() => useSigningPipeline())

        act(() => {
            subscriberCalls[0]({
                matches: (s: string) => s === 'signing',
                context: {
                    error: null,
                    groupSignerTypes: new Map([['g0', 'localKey']]),
                },
            })
        })

        expect(result.current.stage).toBe('signing')
        expect(result.current.isLoading).toBe(true)
    })
})

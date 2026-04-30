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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSigningRequest } from '../useSigningRequest'
import { useSigningStore } from '../../store'
import {
    MAX_TRANSACTION_SIGN_REQUESTS,
    MAX_DATA_SIGN_REQUESTS,
} from '../../constants'
import { AppError, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    SignRequest,
    TransactionSignRequest,
    ArbitraryDataSignRequest,
} from '../../models'
import { createSigningMachine } from '../../machine/createSigningMachine'

// =============================================================================
// Module mocks
// =============================================================================

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => ({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
    }
})

vi.mock('../useLocalKeyTransactionSigner', () => ({
    useLocalKeyTransactionSigner: vi.fn(() => ({
        signTransactions: vi.fn(),
    })),
}))

vi.mock('../useArbitraryDataSigner', () => ({
    useArbitraryDataSigner: vi.fn(() => ({
        signArbitraryData: vi.fn(),
    })),
}))

vi.mock('../useArc60Signer', () => ({
    useArc60Signer: vi.fn(() => ({
        signArc60: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => [
        { address: 'ADDR1', type: 'algo25' },
        { address: 'ADDR2', type: 'algo25' },
    ]),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        useTransactionEncoder: vi.fn(() => ({
            encodeSignedTransactions: vi.fn(),
        })),
        useAlgorandClient: vi.fn(() => ({
            client: { algod: { sendRawTransaction: vi.fn() } },
        })),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    }
})

vi.mock('../../machine/createSigningMachine')

// =============================================================================
// Helpers
// =============================================================================

/**
 * Builds a mock actor whose subscriber callback can be triggered manually.
 */
const makeMockActor = (requestId: string) => {
    let subscriberCb: Nullable<(snapshot: unknown) => void> = null

    const actor = {
        id: requestId,
        subscribe: vi.fn((cb: (snapshot: unknown) => void) => {
            subscriberCb = cb
        }),
        start: vi.fn(),
        stop: vi.fn(),
        send: vi.fn(),
        // Test helper: simulate actor reaching a terminal state
        simulateDone: (matchedState: string, request: SignRequest) => {
            subscriberCb?.({
                status: 'done',
                matches: (s: string) => s === matchedState,
                context: { request },
            })
        },
    }
    return actor
}

const makeTxRequest = (
    overrides: Partial<TransactionSignRequest> = {},
): TransactionSignRequest => ({
    id: 'tx-1',
    type: 'transactions',
    transport: 'algod',
    txs: [{ sender: { toString: () => 'ADDR1' } } as any],
    ...overrides,
})

const makeArbRequest = (
    overrides: Partial<ArbitraryDataSignRequest> = {},
): ArbitraryDataSignRequest => ({
    id: 'arb-1',
    type: 'arbitrary-data',
    transport: 'callback',
    data: [{ signer: 'ADDR1', data: 'hello', chainId: 4160 }],
    ...overrides,
})

// =============================================================================
// Tests
// =============================================================================

describe('useSigningRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSigningStore.getState().resetState()
    })

    describe('queue management', () => {
        test('returns empty pending requests initially', () => {
            const { result } = renderHook(() => useSigningRequest())
            expect(result.current.pendingSignRequests).toEqual([])
        })

        test('addSignRequest adds to pendingSignRequests and creates an actor', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
            expect(result.current.pendingSignRequests[0].id).toBe('tx-1')
            expect(actor.start).toHaveBeenCalled()
        })

        test('throws when transaction count exceeds limit', () => {
            const { result } = renderHook(() => useSigningRequest())
            const txs = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS + 1 },
                () => ({}),
            )
            const request = makeTxRequest({ txs: txs as any })

            expect(() => {
                act(() => {
                    result.current.addSignRequest(request)
                })
            }).toThrow(AppError)
        })

        test('accepts transactions at exactly the limit', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const txs = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS },
                () => ({}),
            )
            const request = makeTxRequest({ txs: txs as any })

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
        })

        test('throws when data sign count exceeds limit', () => {
            const { result } = renderHook(() => useSigningRequest())
            const data = Array.from(
                { length: MAX_DATA_SIGN_REQUESTS + 1 },
                () => ({ signer: 'ADDR1', data: 'test', chainId: 4160 }),
            )
            const request = makeArbRequest({ data: data as any })

            expect(() => {
                act(() => {
                    result.current.addSignRequest(request)
                })
            }).toThrow(AppError)
        })

        test('does not add duplicate requests', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
            expect(createSigningMachine).toHaveBeenCalledTimes(1)
        })

        test('removes request and stops actor on removeSignRequest', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                result.current.removeSignRequest(request)
            })

            expect(actor.stop).toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })

    describe('signAndSendRequest', () => {
        test('sends USER_APPROVED to the matching actor', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                result.current.signAndSendRequest(request)
            })

            expect(actor.send).toHaveBeenCalledWith({ type: 'USER_APPROVED' })
        })

        test('currentRequest is the first pending request', () => {
            // Only the first actor is created — the queue gate prevents
            // the second from starting until the first completes.
            const actor1 = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor1 as any)

            const { result } = renderHook(() => useSigningRequest())
            const req1 = makeTxRequest({ id: 'tx-1' })
            const req2 = makeTxRequest({ id: 'tx-2' })

            act(() => {
                result.current.addSignRequest(req1)
                result.current.addSignRequest(req2)
            })

            expect(result.current.currentRequest?.id).toBe('tx-1')
        })
    })

    describe('rejectRequest', () => {
        test('sends USER_REJECTED to the matching actor', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({ transport: 'callback' })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                result.current.rejectRequest(request)
            })

            expect(actor.send).toHaveBeenCalledWith({ type: 'USER_REJECTED' })
        })

        test('when no actor, calls reject callback and removes request for callback transport', () => {
            const mockReject = vi.fn()

            const { result } = renderHook(() => useSigningRequest())

            // Call rejectRequest for a request that was never added to the
            // store (so no actor was created by the reactive effect).
            // This tests the defensive fallback path.
            act(() => {
                result.current.rejectRequest(
                    makeTxRequest({
                        transport: 'callback',
                        reject: mockReject,
                    }),
                )
            })

            expect(mockReject).toHaveBeenCalled()
        })
    })

    describe('actor lifecycle', () => {
        test('removes request from queue when actor reaches completed state', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)

            act(() => {
                actor.simulateDone('completed', request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('removes request from queue when actor reaches rejected state', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('calls reject callback when actor reaches rejected state with callback transport', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const mockReject = vi.fn()
            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'callback',
                reject: mockReject,
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(mockReject).toHaveBeenCalledTimes(1)
        })

        test('calls reject callback when actor reaches rejected state with algod transport', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const mockReject = vi.fn()
            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'algod',
                reject: mockReject,
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(mockReject).toHaveBeenCalledTimes(1)
        })

        test('sets lastCompletedRequest when actor reaches completed state', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('completed', request)
            })

            expect(result.current.lastCompletedRequest?.id).toBe('tx-1')
        })

        test('does not set lastCompletedRequest for headless requests', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'callback',
                headless: true,
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('completed', request)
            })

            expect(result.current.lastCompletedRequest).toBeNull()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })
})

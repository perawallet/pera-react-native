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
import { initSigningStore } from '../../store'
import type {
    SignRequest,
    TransactionSignRequest,
    ArbitraryDataSignRequest,
} from '../../models'

const mockSignTransactions = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockSignArbitraryData = vi.fn()

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(() => ({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useTransactionSigner: vi.fn(() => ({
        signTransactions: mockSignTransactions,
    })),
    useArbitraryDataSigner: vi.fn(() => ({
        signArbitraryData: mockSignArbitraryData,
    })),
    useAllAccounts: vi.fn(() => [
        { address: 'ADDR1', canSign: true, type: 'algo25' },
        { address: 'ADDR2', canSign: true, type: 'algo25' },
    ]),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: vi.fn(() => ({
        encodeSignedTransactions: mockEncodeSignedTransactions,
    })),
    useAlgorandClient: vi.fn(() => ({
        client: {
            algod: {
                sendRawTransaction: mockSendRawTransaction,
            },
        },
    })),
}))

const makeTxRequest = (
    overrides: Partial<TransactionSignRequest> = {},
): TransactionSignRequest => ({
    id: 'tx-1',
    type: 'transactions',
    transport: 'algod',
    txs: [{ sender: 'ADDR1' } as any],
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

describe('useSigningRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        initSigningStore()
        mockSignTransactions.mockResolvedValue([
            { txn: {}, sig: new Uint8Array() },
        ])
        mockEncodeSignedTransactions.mockReturnValue([
            new Uint8Array([1, 2, 3]),
        ])
        mockSignArbitraryData.mockResolvedValue([new Uint8Array([1, 2, 3])])
    })

    describe('queue management', () => {
        test('returns empty pending requests initially', () => {
            const { result } = renderHook(() => useSigningRequest())
            expect(result.current.pendingSignRequests).toEqual([])
        })

        test('adds a sign request', () => {
            const { result } = renderHook(() => useSigningRequest())
            const request: SignRequest = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
            expect(result.current.pendingSignRequests[0].id).toBe('tx-1')
        })

        test('removes a sign request', () => {
            const { result } = renderHook(() => useSigningRequest())
            const request: SignRequest = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })
            expect(result.current.pendingSignRequests).toHaveLength(1)

            act(() => {
                result.current.removeSignRequest(request)
            })
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })

    describe('signRequest', () => {
        test('signs transaction request and returns result', async () => {
            const request = makeTxRequest()
            const { result } = renderHook(() => useSigningRequest())

            let signResult: unknown
            await act(async () => {
                signResult = await result.current.signRequest(request)
            })

            expect(mockSignTransactions).toHaveBeenCalledWith(request.txs, [0])
            expect(signResult).toEqual({
                type: 'transactions',
                signedTransactions: [{ txn: {}, sig: new Uint8Array() }],
            })
        })

        test('signs arbitrary data request and returns result', async () => {
            const request = makeArbRequest()
            const { result } = renderHook(() => useSigningRequest())

            let signResult: unknown
            await act(async () => {
                signResult = await result.current.signRequest(request)
            })

            expect(mockSignArbitraryData).toHaveBeenCalledWith(
                { address: 'ADDR1', canSign: true, type: 'algo25' },
                'hello',
            )
            expect(signResult).toEqual({
                type: 'arbitrary-data',
                signatures: [
                    { signer: 'ADDR1', signature: new Uint8Array([1, 2, 3]) },
                ],
            })
        })

        test('throws for unsupported request type', async () => {
            const request = {
                id: '1',
                type: 'arc60',
                transport: 'callback',
            } as SignRequest
            const { result } = renderHook(() => useSigningRequest())

            await expect(
                act(async () => {
                    await result.current.signRequest(request)
                }),
            ).rejects.toThrow('Unsupported sign request type: arc60')
        })
    })

    describe('signAndSendRequest', () => {
        test('signs and sends transactions via algod', async () => {
            const request = makeTxRequest({ transport: 'algod' })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await act(async () => {
                await result.current.signAndSendRequest(request)
            })

            expect(mockSignTransactions).toHaveBeenCalled()
            expect(mockEncodeSignedTransactions).toHaveBeenCalled()
            expect(mockSendRawTransaction).toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('signs transactions and calls approve for callback', async () => {
            const mockApprove = vi.fn().mockResolvedValue(undefined)
            const request = makeTxRequest({
                transport: 'callback',
                approve: mockApprove,
            })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await act(async () => {
                await result.current.signAndSendRequest(request)
            })

            expect(mockApprove).toHaveBeenCalled()
            expect(mockSendRawTransaction).not.toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('signs arbitrary data and calls approve', async () => {
            const mockApprove = vi.fn().mockResolvedValue(undefined)
            const request = makeArbRequest({ approve: mockApprove })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await act(async () => {
                await result.current.signAndSendRequest(request)
            })

            expect(mockSignArbitraryData).toHaveBeenCalled()
            expect(mockApprove).toHaveBeenCalledWith([
                { signer: 'ADDR1', signature: new Uint8Array([1, 2, 3]) },
            ])
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('throws for arbitrary data via algod transport', async () => {
            const request = makeArbRequest({ transport: 'algod' })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await expect(
                act(async () => {
                    await result.current.signAndSendRequest(request)
                }),
            ).rejects.toThrow(
                'Arbitrary data signing is not supported via algod transport',
            )
        })

        test('throws for account not found', async () => {
            const request = makeArbRequest({
                data: [{ signer: 'UNKNOWN', data: 'hello', chainId: 4160 }],
            })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await expect(
                act(async () => {
                    await result.current.signAndSendRequest(request)
                }),
            ).rejects.toThrow('Account not found for signer: UNKNOWN')
        })

        test('throws when signature generation fails', async () => {
            mockSignArbitraryData.mockResolvedValue([])
            const request = makeArbRequest()
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            await expect(
                act(async () => {
                    await result.current.signAndSendRequest(request)
                }),
            ).rejects.toThrow('Failed to generate signature for signer: ADDR1')
        })
    })

    describe('rejectRequest', () => {
        test('calls reject and removes for callback transport', () => {
            const mockReject = vi.fn()
            const request = makeTxRequest({
                transport: 'callback',
                reject: mockReject,
            })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            act(() => {
                result.current.rejectRequest(request)
            })

            expect(mockReject).toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('does not call reject for algod transport', () => {
            const mockReject = vi.fn()
            const request = makeTxRequest({
                transport: 'algod',
                reject: mockReject,
            })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            act(() => {
                result.current.rejectRequest(request)
            })

            expect(mockReject).not.toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('works for arbitrary data requests', () => {
            const mockReject = vi.fn()
            const request = makeArbRequest({ reject: mockReject })
            const { result } = renderHook(() => useSigningRequest())

            act(() => {
                result.current.addSignRequest(request)
            })

            act(() => {
                result.current.rejectRequest(request)
            })

            expect(mockReject).toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })
})

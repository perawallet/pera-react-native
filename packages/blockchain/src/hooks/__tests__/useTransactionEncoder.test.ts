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
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useTransactionEncoder } from '../useTransactionEncoder'

vi.mock('@algorandfoundation/algokit-utils/transact', () => ({
    encodeTransaction: vi.fn(() => new Uint8Array([0])),
    decodeTransaction: vi.fn(() => ({})),
    encodeSignedTransaction: vi.fn(() => new Uint8Array([1])),
    encodeSignedTransactions: vi.fn(() => [new Uint8Array([1])]),
    decodeSignedTransaction: vi.fn(() => ({})),
    decodeSignedTransactions: vi.fn(() => [{}]),
}))

describe('useTransactionEncoder', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test('encodeTransaction returns a Uint8Array', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockTransaction = {} as any
        const encoded = result.current.encodeTransaction(mockTransaction)

        expect(encoded).toBeInstanceOf(Uint8Array)
        expect(encoded).toEqual(Uint8Array.from([0]))
    })

    test('encodeSignedTransaction returns a Uint8Array', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockSignedTx = {} as any
        const encoded = result.current.encodeSignedTransaction(mockSignedTx)

        expect(encoded).toBeInstanceOf(Uint8Array)
        expect(encoded).toEqual(Uint8Array.from([1]))
    })

    test('encodeSignedTransactions returns array of Uint8Arrays', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockSignedTxs = [{}] as any[]
        const encoded = result.current.encodeSignedTransactions(mockSignedTxs)

        expect(Array.isArray(encoded)).toBe(true)
        expect(encoded[0]).toBeInstanceOf(Uint8Array)
        expect(encoded[0]).toEqual(Uint8Array.from([1]))
    })

    test('decodeTransaction returns a transaction object', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockEncoded = Uint8Array.from([0])
        const decoded = result.current.decodeTransaction(mockEncoded)

        expect(decoded).toBeDefined()
        expect(typeof decoded).toBe('object')
    })

    test('decodeSignedTransaction returns a signed transaction object', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockEncoded = Uint8Array.from([1])
        const decoded = result.current.decodeSignedTransaction(mockEncoded)

        expect(decoded).toBeDefined()
        expect(typeof decoded).toBe('object')
    })

    test('decodeSignedTransactions returns array of signed transaction objects', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockEncodedTxs = [Uint8Array.from([1])]
        const decoded = result.current.decodeSignedTransactions(mockEncodedTxs)

        expect(Array.isArray(decoded)).toBe(true)
        expect(decoded[0]).toBeDefined()
        expect(typeof decoded[0]).toBe('object')
    })
})

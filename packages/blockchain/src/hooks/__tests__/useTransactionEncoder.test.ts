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

    test('decodeTransaction returns a transaction object', () => {
        const { result } = renderHook(() => useTransactionEncoder(), {
            wrapper,
        })

        const mockEncoded = Uint8Array.from([0])
        const decoded = result.current.decodeTransaction(mockEncoded)

        expect(decoded).toBeDefined()
        expect(typeof decoded).toBe('object')
    })
})

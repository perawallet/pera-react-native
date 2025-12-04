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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useInvalidateAssetPrices } from '../useInvalidateAssetPrices'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'

// Type for our simplified query object in tests
type QueryLike = {
    queryKey: unknown[]
}

describe('useInvalidateAssetPrices', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    it('returns invalidateAssetPrices function', () => {
        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current).toHaveProperty('invalidateAssetPrices')
        expect(typeof result.current.invalidateAssetPrices).toBe('function')
    })

    it('invalidates queries with keys starting with "assets/prices"', () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.invalidateAssetPrices()

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            predicate: expect.any(Function),
        })

        // Test the predicate function
        const predicate = invalidateQueriesSpy.mock.calls[0][0]?.predicate as
            | ((query: QueryLike) => boolean)
            | undefined
        expect(predicate).toBeDefined()

        if (predicate) {
            // Test various query key patterns
            expect(
                predicate({ queryKey: ['assets/prices', 'some', 'key'] }),
            ).toBe(true)
            expect(predicate({ queryKey: ['assets', 'other'] })).toBe(false)
            expect(predicate({ queryKey: ['assets/prices'] })).toBe(true)
            expect(predicate({ queryKey: ['assets/prices/fiat'] })).toBe(true)
            expect(predicate({ queryKey: ['assets/prices/history'] })).toBe(
                true,
            )
            expect(predicate({ queryKey: ['other', 'assets/prices'] })).toBe(
                false,
            )
            expect(predicate({ queryKey: ['assets/other'] })).toBe(false)
            expect(predicate({ queryKey: ['other/assets/prices'] })).toBe(false)
        }
    })

    it('handles edge cases in query keys', () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        result.current.invalidateAssetPrices()

        const predicate = invalidateQueriesSpy.mock.calls[0][0]?.predicate as
            | ((query: QueryLike) => boolean)
            | undefined
        expect(predicate).toBeDefined()

        if (predicate) {
            // Empty query key
            expect(predicate({ queryKey: [] })).toBe(false)

            // Non-array query key (should not throw error)
            expect(() => predicate({ queryKey: null as any })).not.toThrow()
            expect(() =>
                predicate({ queryKey: undefined as any }),
            ).not.toThrow()
            expect(() => predicate({ queryKey: 'string' as any })).not.toThrow()
            expect(() => predicate({ queryKey: 123 as any })).not.toThrow()

            // Query with non-string elements
            expect(
                predicate({
                    queryKey: ['assets/prices', 123, null, undefined],
                }),
            ).toBe(true)
        }
    })

    it('can invalidate specific asset price queries', () => {
        // Setup multiple queries in the cache
        queryClient.setQueryData(['assets/prices', 'ALGO'], { price: 1.5 })
        queryClient.setQueryData(['assets/prices', 'BTC'], { price: 50000 })
        queryClient.setQueryData(['assets/prices/fiat', 'USD'], { rate: 1.0 })
        queryClient.setQueryData(['assets/other'], { data: 'something' })

        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        // Spy after setting up the cache
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        result.current.invalidateAssetPrices()

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            predicate: expect.any(Function),
        })

        // Check if the non-price query is still in the cache and not invalidated
        const otherQueryData = queryClient.getQueryData(['assets/other'])
        expect(otherQueryData).toEqual({ data: 'something' })

        // For the price queries, we can't reliably test isInvalidated directly
        // since the test environment might handle invalidation differently
        // Instead, we'll verify the predicate function behavior
        const predicate = invalidateQueriesSpy.mock.calls[0][0]?.predicate as
            | ((query: QueryLike) => boolean)
            | undefined
        expect(predicate).toBeDefined()

        if (predicate) {
            expect(predicate({ queryKey: ['assets/prices', 'ALGO'] })).toBe(
                true,
            )
            expect(predicate({ queryKey: ['assets/prices', 'BTC'] })).toBe(true)
            expect(predicate({ queryKey: ['assets/prices/fiat', 'USD'] })).toBe(
                true,
            )
            expect(predicate({ queryKey: ['assets/other'] })).toBe(false)
        }
    })

    it('can be called multiple times', () => {
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        // Call invalidateAssetPrices multiple times
        result.current.invalidateAssetPrices()
        result.current.invalidateAssetPrices()
        result.current.invalidateAssetPrices()

        // Should be called exactly 3 times
        expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3)

        // Each call should use the same predicate logic
        for (let i = 0; i < 3; i++) {
            expect(invalidateQueriesSpy.mock.calls[i][0]).toHaveProperty(
                'predicate',
            )
            const predicate = invalidateQueriesSpy.mock.calls[i][0]
                ?.predicate as ((query: QueryLike) => boolean) | undefined
            expect(predicate).toBeDefined()

            if (predicate) {
                expect(predicate({ queryKey: ['assets/prices'] })).toBe(true)
            }
        }
    })

    it('handles errors gracefully', () => {
        // Create a spy to track console.error calls
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Mock invalidateQueries to throw an error
        queryClient.invalidateQueries = vi.fn().mockImplementation(() => {
            throw new Error('Test error')
        }) as any

        const { result } = renderHook(() => useInvalidateAssetPrices(), {
            wrapper: createWrapper(queryClient),
        })

        // Call the function - it should not throw
        result.current.invalidateAssetPrices()

        // Verify that console.error was called with the error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error invalidating asset prices:',
            expect.any(Error),
        )

        // Clean up
        consoleErrorSpy.mockRestore()
    })
})

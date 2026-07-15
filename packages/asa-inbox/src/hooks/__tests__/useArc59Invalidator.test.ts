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
import { renderHook, act } from '@testing-library/react'
import { useArc59Invalidator } from '../useArc59Invalidator'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAllPredicate } from '../querykeys'

vi.mock('@tanstack/react-query', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@tanstack/react-query')>()
    return {
        ...actual,
        useQueryClient: vi.fn(),
    }
})

describe('useArc59Invalidator', () => {
    const mockInvalidateQueries = vi.fn()
    const mockRemoveQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useQueryClient).mockReturnValue({
            invalidateQueries: mockInvalidateQueries,
            removeQueries: mockRemoveQueries,
        } as never)
    })

    it('should return invalidate and remove functions', () => {
        const { result } = renderHook(() => useArc59Invalidator())

        expect(result.current.invalidate).toBeTypeOf('function')
        expect(result.current.remove).toBeTypeOf('function')
    })

    it('should call invalidateQueries with the correct predicate', () => {
        const { result } = renderHook(() => useArc59Invalidator())

        act(() => {
            result.current.invalidate()
        })

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            predicate: invalidateAllPredicate,
        })
        expect(mockRemoveQueries).not.toHaveBeenCalled()
    })

    it('should call removeQueries with the correct predicate', () => {
        const { result } = renderHook(() => useArc59Invalidator())

        act(() => {
            result.current.remove()
        })

        expect(mockRemoveQueries).toHaveBeenCalledWith({
            predicate: invalidateAllPredicate,
        })
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it('should allow calling invalidate and remove independently', () => {
        const { result } = renderHook(() => useArc59Invalidator())

        act(() => {
            result.current.invalidate()
            result.current.remove()
            result.current.invalidate()
        })

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(2)
        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
    })
})

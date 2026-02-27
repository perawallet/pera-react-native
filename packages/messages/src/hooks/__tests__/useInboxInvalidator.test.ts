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
import { renderHook, act } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-core-platform-integration'
import { useInboxInvalidator } from '../useInboxInvalidator'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAllPredicate } from '../querykeys'

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>()
    return {
        ...actual,
        useQueryClient: vi.fn(),
    }
})

describe('useInboxInvalidator', () => {
    const mockInvalidateQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useQueryClient).mockReturnValue({
            invalidateQueries: mockInvalidateQueries,
        } as never)
    })

    it('should return an invalidate function', () => {
        const { result } = renderHook(() => useInboxInvalidator())

        expect(result.current.invalidate).toBeTypeOf('function')
    })

    it('should call invalidateQueries with the correct predicate when invalidate is called', () => {
        const { result } = renderHook(() => useInboxInvalidator())

        act(() => {
            result.current.invalidate()
        })

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            predicate: invalidateAllPredicate,
        })
    })

    it('should call invalidateQueries each time invalidate is called', () => {
        const { result } = renderHook(() => useInboxInvalidator())

        act(() => {
            result.current.invalidate()
            result.current.invalidate()
            result.current.invalidate()
        })

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(3)
    })
})

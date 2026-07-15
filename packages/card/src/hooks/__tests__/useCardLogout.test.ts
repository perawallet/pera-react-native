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
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { clearCardSession } = vi.hoisted(() => ({ clearCardSession: vi.fn() }))
vi.mock('../../session', () => ({ clearCardSession }))

import { useCardLogout } from '../useCardLogout'

describe('useCardLogout', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient()
        vi.clearAllMocks()
        clearCardSession.mockResolvedValue(undefined)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('clears the session and invalidates card queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useCardLogout(), { wrapper })
        await result.current.logout()

        expect(clearCardSession).toHaveBeenCalledTimes(1)
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ predicate: expect.any(Function) }),
        )
    })
})

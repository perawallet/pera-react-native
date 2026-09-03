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

import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

const { listLogins } = vi.hoisted(() => ({ listLogins: vi.fn() }))
vi.mock('../../storage/loginStore', () => ({ listLogins }))

import { isLoginQuery, useLoginsQuery } from '../useLoginsQuery'

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe('useLoginsQuery', () => {
    it('returns the stored logins', async () => {
        listLogins.mockResolvedValue([
            {
                id: 'pera.login.abc',
                domain: 'example.com',
                username: 'ada@example.com',
                note: null,
                createdAt: 1,
                updatedAt: 1,
            },
        ])

        const { result } = renderHook(() => useLoginsQuery(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.logins).toHaveLength(1)
    })

    it('returns an empty array rather than undefined before data arrives', () => {
        listLogins.mockReturnValue(new Promise(() => undefined))

        const { result } = renderHook(() => useLoginsQuery(), { wrapper })

        expect(result.current.logins).toEqual([])
    })
})

describe('isLoginQuery', () => {
    it('matches the list key and any per-record key', () => {
        expect(isLoginQuery(['logins'])).toBe(true)
        expect(isLoginQuery(['logins', 'pera.login.abc'])).toBe(true)
    })

    it('does not match other modules', () => {
        expect(isLoginQuery(['accounts'])).toBe(false)
        expect(isLoginQuery([])).toBe(false)
    })
})

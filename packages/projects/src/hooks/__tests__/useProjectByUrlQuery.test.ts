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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useProjectByUrlQuery } from '../useProjectByUrlQuery'
import * as projectsEndpoints from '../../api/projects/endpoints'
import type { PeraProject } from '../../models/types'

vi.mock('../../api/projects/endpoints')

vi.mock('@perawallet/wallet-core-platform-extension', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet', setNetwork: vi.fn() })),
}))

const mockProject: PeraProject = {
    name: 'Tinyman',
    url: 'https://tinyman.org',
    verificationTier: 'verified',
    logoPng: 'https://tinyman.org/logo.png',
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useProjectByUrlQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('fetches project by URL and returns first match', async () => {
        vi.mocked(projectsEndpoints.fetchProjectByUrl).mockResolvedValue([
            mockProject,
        ])

        const { result } = renderHook(
            () =>
                useProjectByUrlQuery({
                    url: 'https://tinyman.org',
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(true)

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toEqual(mockProject)
        expect(result.current.isError).toBe(false)
    })

    test('returns null when no projects match', async () => {
        vi.mocked(projectsEndpoints.fetchProjectByUrl).mockResolvedValue([])

        const { result } = renderHook(
            () =>
                useProjectByUrlQuery({
                    url: 'https://unknown.com',
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toBeNull()
    })

    test('is disabled when url is not provided', () => {
        const { result } = renderHook(
            () =>
                useProjectByUrlQuery({
                    url: undefined,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.data).toBeUndefined()
        expect(projectsEndpoints.fetchProjectByUrl).not.toHaveBeenCalled()
    })

    test('is disabled when isEnabled is false', () => {
        const { result } = renderHook(
            () =>
                useProjectByUrlQuery({
                    url: 'https://tinyman.org',
                    isEnabled: false,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isLoading).toBe(false)
        expect(projectsEndpoints.fetchProjectByUrl).not.toHaveBeenCalled()
    })

    test('handles errors', async () => {
        vi.mocked(projectsEndpoints.fetchProjectByUrl).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(
            () =>
                useProjectByUrlQuery({
                    url: 'https://tinyman.org',
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.data).toBeUndefined()
    })
})

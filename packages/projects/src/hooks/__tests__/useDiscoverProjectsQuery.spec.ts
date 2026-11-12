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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useDiscoverProjectsQuery } from '../useDiscoverProjectsQuery'
import * as projectsEndpoints from '../../api/projects/endpoints'
import type { PeraProject } from '../../models/types'

vi.mock('../../api/projects/endpoints')
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
}))

const mockProject: PeraProject = {
    id: 'p1',
    name: 'Uniswap',
    url: 'https://app.uniswap.org',
    chains: ['eip155:1'],
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDiscoverProjectsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('fetches the discover list for the deployment, platform and chains', async () => {
        vi.mocked(projectsEndpoints.fetchDiscoverProjects).mockResolvedValue([
            mockProject,
        ])

        const { result } = renderHook(
            () =>
                useDiscoverProjectsQuery({
                    platform: 'android',
                    chains: ['eip155:1'],
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(projectsEndpoints.fetchDiscoverProjects).toHaveBeenCalledWith(
            expect.objectContaining({
                deployment: 'live',
                platform: 'android',
                chains: ['eip155:1'],
            }),
        )
        expect(result.current.data).toEqual([mockProject])
    })

    test('does not fetch while disabled', () => {
        const { result } = renderHook(
            () =>
                useDiscoverProjectsQuery({
                    platform: 'ios',
                    chains: [],
                    isEnabled: false,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(projectsEndpoints.fetchDiscoverProjects).not.toHaveBeenCalled()
    })
})

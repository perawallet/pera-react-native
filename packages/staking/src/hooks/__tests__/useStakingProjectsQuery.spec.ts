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

import React from 'react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { useStakingProjectsQuery } from '../useStakingProjectsQuery'

const VALID_PROJECTS_CONFIG = JSON.stringify([
    {
        id: 'folks',
        title: 'Folks Finance',
        description:
            'Stake your Algo on Folks to collect rewards and receive xALGO',
        logoUrl: 'https://example.com/folks.png',
        link: 'https://app.folks.finance/liquid-staking?ref=pera',
        type: 'liquid',
    },
    {
        id: 'pact',
        title: 'Pact',
        description:
            'On Pact, eligible Algo-paired liquidity pools (LPs) will automatically participate in consensus',
        logoUrl: 'https://example.com/pact.png',
        link: 'https://app.pact.fi/stake',
        type: 'pools',
    },
    {
        id: 'valar',
        title: 'Valar',
        description:
            'Stake your Algo to a network of node runners without it leaving your wallet',
        logoUrl: 'https://example.com/valar.png',
        link: 'https://stake.valar.solutions/',
        type: 'delegated',
    },
])

const mocks = vi.hoisted(() => ({
    fetchStakingProjectsInfo: vi.fn(),
    getStringValue: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchStakingProjectsInfo: mocks.fetchStakingProjectsInfo,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
    microAlgosToAlgos: (v: unknown) =>
        new Decimal(v?.toString() ?? '0').div(1_000_000),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    RemoteConfigKeys: { staking_projects: 'staking_projects' },
    useRemoteConfig: () => ({
        getStringValue: mocks.getStringValue,
    }),
}))

describe('useStakingProjectsQuery', () => {
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
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.getStringValue.mockReturnValue(VALID_PROJECTS_CONFIG)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('merges projects and sorts by tvl in algo descending', async () => {
        mocks.fetchStakingProjectsInfo.mockResolvedValue({
            folks: {
                tvl_in_algo: '1000',
                tvl_in_usd: '1200',
            },
            pact: {
                tvl_in_algo: '2000',
                tvl_in_usd: '2500',
            },
            valar: {
                tvl_in_algo: '500',
                tvl_in_usd: '630',
            },
        })

        const { result } = renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.data[0].id).toBe('pact')
        expect(result.current.data[1].id).toBe('folks')
        expect(result.current.data[2].id).toBe('valar')
        expect(result.current.data[0].tvlInAlgo.toString()).toBe('0.002')
        expect(result.current.data[0].tvlInUsd.toString()).toBe('2500')
        expect(result.current.data.length).toBe(3)
    })

    it('returns error state when tvl request fails', async () => {
        mocks.fetchStakingProjectsInfo.mockRejectedValue(new Error('Failed'))

        const { result } = renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Failed')
    })

    it('surfaces invalid remote config JSON as error state (does not crash)', async () => {
        mocks.getStringValue.mockReturnValue('not-json')
        mocks.fetchStakingProjectsInfo.mockResolvedValue({})

        const { result } = renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toEqual([])
        expect(result.current.error?.message).toBe(
            'Invalid staking projects remote config JSON',
        )
    })

    it('surfaces schema validation failures as error state (does not crash)', async () => {
        mocks.getStringValue.mockReturnValue(
            JSON.stringify([
                {
                    id: '',
                    title: 'Invalid',
                    description: 'Invalid',
                    logoUrl: 'https://example.com/logo.png',
                    link: 'https://example.com',
                    type: 'liquid',
                },
            ]),
        )
        mocks.fetchStakingProjectsInfo.mockResolvedValue({})

        const { result } = renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toEqual([])
        expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns empty list when remote config value is missing or empty', async () => {
        mocks.getStringValue.mockReturnValue('')
        mocks.fetchStakingProjectsInfo.mockResolvedValue({})

        const { result } = renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.data).toEqual([])
        expect(result.current.isError).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('uses the active network when fetching', async () => {
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })
        mocks.fetchStakingProjectsInfo.mockResolvedValue({})

        renderHook(() => useStakingProjectsQuery(), {
            wrapper,
        })

        await waitFor(() =>
            expect(mocks.fetchStakingProjectsInfo).toHaveBeenCalledWith(
                'testnet',
            ),
        )
    })

    describe('offline', () => {
        afterEach(() => {
            onlineManager.setOnline(true)
        })

        it('reports isPaused (not isLoading) when offline with no cached TVL', async () => {
            onlineManager.setOnline(false)
            mocks.getStringValue.mockReturnValue(VALID_PROJECTS_CONFIG)

            const { result } = renderHook(() => useStakingProjectsQuery(), {
                wrapper,
            })

            await waitFor(() => expect(result.current.isPaused).toBe(true))
            expect(result.current.isLoading).toBe(false)
            expect(result.current.isError).toBe(false)
            expect(mocks.fetchStakingProjectsInfo).not.toHaveBeenCalled()
        })

        it('serves cached TVL data (stale) when going offline after a successful fetch', async () => {
            mocks.getStringValue.mockReturnValue(VALID_PROJECTS_CONFIG)
            mocks.fetchStakingProjectsInfo.mockResolvedValue({
                folks: {
                    tvl_in_algo: '1000',
                    tvl_in_usd: '1200',
                },
                pact: {
                    tvl_in_algo: '2000',
                    tvl_in_usd: '2500',
                },
                valar: {
                    tvl_in_algo: '500',
                    tvl_in_usd: '630',
                },
            })

            const { result, rerender } = renderHook(
                () => useStakingProjectsQuery(),
                { wrapper },
            )

            await waitFor(() =>
                expect(result.current.data.length).toBeGreaterThan(0),
            )

            onlineManager.setOnline(false)
            rerender()

            expect(result.current.isPaused).toBe(false)
            expect(result.current.isLoading).toBe(false)
            expect(result.current.data.length).toBeGreaterThan(0)
        })
    })
})

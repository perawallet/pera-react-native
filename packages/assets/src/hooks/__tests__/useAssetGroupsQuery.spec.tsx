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

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { useAssetGroupsQuery } from '../useAssetGroupsQuery'
import { createWrapper } from './test-utils'

const mocks = vi.hoisted(() => ({ fetchAssetGroups: vi.fn() }))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return { ...actual, fetchAssetGroups: mocks.fetchAssetGroups }
})

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
}))

const chains = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: chains.current }),
}))

describe('useAssetGroupsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        const registry = createChainRegistry()
        registry.register(
            {
                id: 'ethereum',
                networks: [
                    { id: 'mainnet', tier: 'mainnet', caip2: 'eip155:1' },
                ],
            } as unknown as ChainDescriptor,
            Object.fromEntries(
                CHAIN_CAPABILITIES.map(capability => [capability, true]),
            ) as ChainCapabilities,
        )
        chains.current = registry
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    it('maps the response into groups on registered scopes', async () => {
        mocks.fetchAssetGroups.mockResolvedValue({
            results: [
                {
                    id: 'usdc',
                    name: 'USD Coin',
                    symbol: 'USDC',
                    logo_url: null,
                    members: [{ chain_id: 'eip155:1', asset_id: '0xA0b8' }],
                },
            ],
        })

        const { result } = renderHook(() => useAssetGroupsQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(mocks.fetchAssetGroups).toHaveBeenCalledWith('live')
        expect(result.current.groups).toEqual([
            {
                id: 'usdc',
                name: 'USD Coin',
                symbol: 'USDC',
                logoUrl: null,
                members: [
                    {
                        scope: { chainId: 'ethereum', networkId: 'mainnet' },
                        assetId: '0xA0b8',
                    },
                ],
            },
        ])
    })

    it('sends no request while disabled', () => {
        const { result } = renderHook(
            () => useAssetGroupsQuery({ enabled: false }),
            { wrapper: createWrapper(queryClient) },
        )

        expect(mocks.fetchAssetGroups).not.toHaveBeenCalled()
        expect(result.current.groups).toEqual([])
    })

    it('yields no groups when the request fails', async () => {
        mocks.fetchAssetGroups.mockRejectedValue(new Error('500'))

        const { result } = renderHook(() => useAssetGroupsQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.groups).toEqual([])
    })
})

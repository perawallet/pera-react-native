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
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { create } from 'zustand'
import type {
    ChainNetwork,
    ChainRegistry,
} from '@perawallet/wallet-core-chain-contract'
import { queryClient } from '@perawallet/wallet-core-shared'
import { fetchPeraServedChainIds, PERA_CHAINS_PATH } from '../chainsEndpoints'
import {
    toServedScopes,
    usePeraServedChainsQuery,
} from '../usePeraServedChainsQuery'

const mocks = vi.hoisted(() => ({
    deployment: 'live' as 'live' | 'developer',
    setPeraServedScopes: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
}))

const integrity = vi.hoisted(() => ({
    store: undefined as unknown as {
        getState: () => { canCall: boolean }
        setState: (state: { canCall: boolean }) => void
    },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: vi.fn(),
    logger: {
        warn: mocks.warn,
        debug: vi.fn(),
        info: mocks.info,
        error: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-app-integrity', () => {
    integrity.store = create<{ canCall: boolean }>()(() => ({ canCall: true }))
    return {
        buildIntegrityHeaders: () => ({ 'X-Integrity-Token': 'token' }),
        useAppIntegrityStore: integrity.store,
        canCallIntegrityGuardedRoute: () => integrity.store.getState().canCall,
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => mocks.deployment,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<object>()),
    // Mainnets on `live`, everything else on `developer`, betanet on neither.
    peraDeploymentOf: ({ networkId }: { networkId: string }) =>
        networkId === 'mainnet'
            ? 'live'
            : networkId === 'betanet'
              ? undefined
              : 'developer',
    setPeraServedScopes: mocks.setPeraServedScopes,
}))

const NETWORKS: Record<string, { chainId: string; networkId: string }> = {
    'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k': {
        chainId: 'algorand',
        networkId: 'mainnet',
    },
    'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe': {
        chainId: 'algorand',
        networkId: 'testnet',
    },
    'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2': {
        chainId: 'algorand',
        networkId: 'betanet',
    },
    'eip155:1': { chainId: 'ethereum', networkId: 'mainnet' },
    'eip155:11155111': { chainId: 'ethereum', networkId: 'sepolia' },
}

const chains = {
    list: () => [
        {
            networks: Object.keys(NETWORKS)
                .filter(caip2 => NETWORKS[caip2].chainId === 'algorand')
                .map(caip2 => ({ caip2 })),
        },
        {
            networks: Object.keys(NETWORKS)
                .filter(caip2 => NETWORKS[caip2].chainId === 'ethereum')
                .map(caip2 => ({ caip2 })),
        },
    ],
    byCaip2: (caip2: string) => {
        const scope = NETWORKS[caip2]
        return scope
            ? {
                  chainId: scope.chainId,
                  network: { id: scope.networkId } as ChainNetwork,
              }
            : undefined
    },
} as unknown as ChainRegistry

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains }),
}))

const mockedQueryClient = vi.mocked(queryClient)

const answer = (data: unknown) =>
    mockedQueryClient.mockResolvedValue({ data, status: 200, statusText: 'OK' })

const chainList = (...ids: string[]) => ({
    results: ids.map(chain_id => ({ chain_id, name: chain_id })),
})

const renderQuery = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => usePeraServedChainsQuery(), { wrapper })
}

describe('device/hooks/usePeraServedChainsQuery', () => {
    beforeEach(() => {
        mocks.deployment = 'live'
        integrity.store.setState({ canCall: true })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('toServedScopes', () => {
        it("keeps the deployment's registered scopes and drops unknown ids and other deployments' scopes", () => {
            const scopes = toServedScopes(
                [
                    'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                    'eip155:1',
                    'eip155:11155111',
                    'eip155:8453',
                    'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2',
                ],
                chains,
                'live',
            )

            expect(scopes).toEqual([
                { chainId: 'algorand', networkId: 'mainnet' },
                { chainId: 'ethereum', networkId: 'mainnet' },
            ])
        })
    })

    describe('fetchPeraServedChainIds', () => {
        it("asks the deployment's chain list with integrity headers", async () => {
            answer(chainList('eip155:1'))

            const ids = await fetchPeraServedChainIds('developer')

            expect(ids).toEqual(['eip155:1'])
            expect(mockedQueryClient).toHaveBeenCalledWith({
                backend: 'pera',
                deployment: 'developer',
                method: 'GET',
                url: PERA_CHAINS_PATH,
                headers: { 'X-Integrity-Token': 'token' },
            })
        })

        it.each([
            ['no results', {}],
            ['an item without a chain id', { results: [{ name: 'x' }] }],
            ['an empty body', undefined],
        ])('rejects %s', async (_case, data) => {
            answer(data)

            await expect(fetchPeraServedChainIds('live')).rejects.toThrow()
        })
    })

    it('hands the served scopes of the wallet deployment to config', async () => {
        answer(
            chainList(
                'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                'eip155:11155111',
            ),
        )

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mocks.setPeraServedScopes).toHaveBeenCalledWith('live', [
            { chainId: 'algorand', networkId: 'mainnet' },
        ])
        expect(result.current.servedScopes).toEqual([
            { chainId: 'algorand', networkId: 'mainnet' },
        ])
    })

    it('waits for the integrity token before reading the list', async () => {
        integrity.store.setState({ canCall: false })
        answer(chainList('algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'))

        const { result } = renderQuery()

        expect(mockedQueryClient).not.toHaveBeenCalled()
        act(() => integrity.store.setState({ canCall: true }))
        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mockedQueryClient).toHaveBeenCalledOnce()
        expect(mocks.setPeraServedScopes).toHaveBeenCalledWith('live', [
            { chainId: 'algorand', networkId: 'mainnet' },
        ])
    })

    it('logs the networks a list switches off beside the ids it names that the build does not know', async () => {
        answer(
            chainList('eip155:1', 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73X'),
        )

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mocks.info).toHaveBeenCalledWith(
            'Pera chain list switches networks off',
            {
                deployment: 'live',
                switchedOff: ['algorand/mainnet'],
                unrecognisedChainIds: [
                    'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73X',
                ],
            },
        )
        expect(mocks.warn).not.toHaveBeenCalled()
    })

    it('logs nothing when the list serves every network of the deployment', async () => {
        answer(
            chainList('algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k', 'eip155:1'),
        )

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mocks.info).not.toHaveBeenCalled()
    })

    it('records nothing when the read fails', async () => {
        mockedQueryClient.mockRejectedValue(new Error('offline'))

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mocks.setPeraServedScopes).not.toHaveBeenCalled()
        expect(result.current.servedScopes).toEqual([])
    })

    it("records nothing for a list naming none of the deployment's networks", async () => {
        answer(chainList('eip155:8453', 'eip155:11155111'))

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isFetched).toBe(true))
        expect(mocks.setPeraServedScopes).not.toHaveBeenCalled()
        expect(mocks.warn).toHaveBeenCalledOnce()
    })
})

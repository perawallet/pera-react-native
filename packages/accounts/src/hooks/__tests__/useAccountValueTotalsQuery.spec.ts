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
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AccountChains } from '../../models'
import type { WalletAccount } from '../../models/accounts'
import { useAccountValueTotalsQuery } from '../useAccountValueTotalsQuery'
import { testAccount } from '../../__tests__/accountFactory'
import { TESTNET_SCOPE } from '../../__tests__/fakeAccountsChain'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const mockGetAccountPortfolioTotals = vi.fn()
const mockEnsureAccountFetched = vi.fn()
const capability = vi.hoisted(() => ({ pricing: true }))

vi.mock('../../db', () => ({
    getAccountPortfolioTotals: (...args: unknown[]) =>
        mockGetAccountPortfolioTotals(...args),
}))

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: (...args: unknown[]) =>
        mockEnsureAccountFetched(...args),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: (_chainId: string, name: string) =>
        name === 'pricing' ? capability.pricing : true,
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const makeAccount = (address: string): WalletAccount =>
    testAccount('local', address, { id: address, name: address })

const totals = (
    nativeAmount: number,
    nonNativeUsd: number,
    nativeUsdPrice: number | null = 2,
) => ({
    nativeAmount: new Decimal(nativeAmount),
    nativeUsdPrice:
        nativeUsdPrice === null ? null : new Decimal(nativeUsdPrice),
    nonNativeUsdValue: new Decimal(nonNativeUsd),
    holdingsCount: 2,
    missingMetadataCount: 0,
})

describe('useAccountValueTotalsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capability.pricing = true
        mockEnsureAccountFetched.mockResolvedValue(undefined)
    })

    it('derives per-account and portfolio values from the SQL totals', async () => {
        mockGetAccountPortfolioTotals.mockImplementation(
            ({ accountAddress }: { accountAddress: string }) =>
                accountAddress === 'A1'
                    ? Promise.resolve(totals(10, 20))
                    : Promise.resolve(totals(0, 4)),
        )

        const { result } = renderHook(
            () =>
                useAccountValueTotalsQuery(
                    [makeAccount('A1'), makeAccount('A2')],
                    SCOPE,
                ),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        // A1: usd = 20 + 10×2 = 40; native = 10 + 20/2 = 20
        const a1 = result.current.accountValueTotals.get('A1')
        expect(a1?.usdValue).toEqual(new Decimal(40))
        expect(a1?.nativeValue).toEqual(new Decimal(20))
        // A2: usd = 4; native = 4/2 = 2
        const a2 = result.current.accountValueTotals.get('A2')
        expect(a2?.usdValue).toEqual(new Decimal(4))
        expect(a2?.nativeValue).toEqual(new Decimal(2))

        expect(result.current.portfolioNativeValue).toEqual(new Decimal(22))
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(44))
    })

    it('falls back to the raw native amount when no native price is known', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30, null))

        const { result } = renderHook(
            () => useAccountValueTotalsQuery([makeAccount('A1')], SCOPE),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(
            result.current.accountValueTotals.get('A1')?.nativeValue,
        ).toEqual(new Decimal(7))
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(
            () => useAccountValueTotalsQuery([], SCOPE),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.accountValueTotals.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('keeps the result referentially stable across renders with a fresh but equal accounts array', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue(totals(1, 1))

        const { result, rerender } = renderHook(
            ({ accounts }: { accounts: WalletAccount[] }) =>
                useAccountValueTotalsQuery(accounts, SCOPE),
            {
                wrapper: createWrapper(),
                initialProps: { accounts: [makeAccount('A1')] },
            },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const first = result.current.accountValueTotals
        rerender({ accounts: [makeAccount('A1')] })

        expect(result.current.accountValueTotals).toBe(first)
    })

    describe('fiatValue', () => {
        const renderTotals = async () => {
            const hook = renderHook(
                () => useAccountValueTotalsQuery([makeAccount('A1')], SCOPE),
                { wrapper: createWrapper() },
            )
            await waitFor(() =>
                expect(hook.result.current.isPending).toBe(false),
            )
            return hook
        }
        const a1 = (r: {
            current: { accountValueTotals: Map<string, unknown> }
        }) =>
            r.current.accountValueTotals.get('A1') as {
                fiatValue: Decimal | null
                usdValue: Decimal | null
                nativeValue: Decimal
            }

        it('equals usdValue when the native price is known', async () => {
            mockGetAccountPortfolioTotals.mockImplementation(
                ({ accountAddress }: { accountAddress: string }) =>
                    accountAddress === 'A1'
                        ? Promise.resolve(totals(10, 20))
                        : Promise.resolve(totals(0, 4)),
            )

            const { result } = renderHook(
                () =>
                    useAccountValueTotalsQuery(
                        [makeAccount('A1'), makeAccount('A2')],
                        SCOPE,
                    ),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))

            const map = result.current.accountValueTotals
            expect(map.get('A1')?.fiatValue).toEqual(new Decimal(40))
            expect(map.get('A2')?.fiatValue).toEqual(new Decimal(4))
        })

        it('is null when native is held and unpriced, leaving the existing values alone', async () => {
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30, null))

            const { result } = await renderTotals()

            expect(a1(result).fiatValue).toBeNull()
            expect(a1(result).nativeValue).toEqual(new Decimal(7))
            expect(a1(result).usdValue).toBeNull()
        })

        it('is a Decimal when no native is held and it is unpriced', async () => {
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(0, 30, null))

            const { result } = await renderTotals()

            expect(a1(result).fiatValue).toEqual(new Decimal(30))
        })
    })

    describe('on a chain with no price source', () => {
        it('keeps usdValue a Decimal while an unpriced native balance is still unknown fiat', async () => {
            capability.pricing = false
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(7, 30, null))

            const { result } = renderHook(
                () => useAccountValueTotalsQuery([makeAccount('A1')], SCOPE),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))

            const total = result.current.accountValueTotals.get('A1')
            expect(total?.usdValue).toEqual(new Decimal(30))
            expect(total?.fiatValue).toBeNull()
        })
    })

    describe('network tiers', () => {
        const SECOND_CHAIN_ID = 'ethereum' as ChainId
        const SECOND_CHAIN_TEST_SCOPE: ChainScope = {
            chainId: SECOND_CHAIN_ID,
            networkId: 'sepolia',
        }

        const registerChain = (chainId: ChainId, testNetworkId: string) =>
            getProvider().chains.register(
                {
                    id: chainId,
                    networks: [
                        {
                            id: 'mainnet',
                            tier: 'mainnet',
                            isDefaultForTier: true,
                        },
                        {
                            id: testNetworkId,
                            tier: 'testnet',
                            isDefaultForTier: true,
                        },
                    ],
                } as unknown as ChainDescriptor,
                Object.fromEntries(
                    CHAIN_CAPABILITIES.map(capability => [capability, false]),
                ) as ChainCapabilities,
            )

        const registerBothChains = () => {
            registerChain(SCOPE.chainId, TESTNET_SCOPE.networkId)
            registerChain(SECOND_CHAIN_ID, SECOND_CHAIN_TEST_SCOPE.networkId)
        }

        const makeSecondChainAccount = (address: string): WalletAccount =>
            testAccount('watch', address, {
                id: address,
                chains: {
                    [SECOND_CHAIN_ID]: { address },
                } as unknown as AccountChains,
            })

        beforeEach(() => {
            mockGetAccountPortfolioTotals.mockResolvedValue(totals(10, 20))
        })

        it('keeps the fiat total of a lone chain on its test network', async () => {
            registerChain(SCOPE.chainId, TESTNET_SCOPE.networkId)

            const { result } = renderHook(
                () =>
                    useAccountValueTotalsQuery(
                        [makeAccount('A1')],
                        TESTNET_SCOPE,
                    ),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.hasFiatTotal).toBe(true)
            expect(result.current.portfolioUsdValue).toEqual(new Decimal(40))
        })

        it('counts mainnet scopes and leaves test-tier scopes out of the fiat total', async () => {
            registerBothChains()

            const { result } = renderHook(
                () => ({
                    mainnet: useAccountValueTotalsQuery(
                        [makeAccount('A1')],
                        SCOPE,
                    ),
                    testTier: useAccountValueTotalsQuery(
                        [makeSecondChainAccount('E1')],
                        SECOND_CHAIN_TEST_SCOPE,
                    ),
                }),
                { wrapper: createWrapper() },
            )
            await waitFor(() => {
                expect(result.current.mainnet.isPending).toBe(false)
                expect(result.current.testTier.isPending).toBe(false)
            })

            const { mainnet, testTier } = result.current
            expect(mainnet.hasFiatTotal).toBe(true)
            expect(mainnet.portfolioUsdValue).toEqual(new Decimal(40))
            expect(testTier.hasFiatTotal).toBe(false)
            expect(testTier.portfolioUsdValue).toEqual(new Decimal(0))
            expect(testTier.accountValueTotals.get('E1')?.usdValue).toEqual(
                new Decimal(40),
            )
            expect(testTier.portfolioNativeValue).toEqual(new Decimal(20))
        })

        it('leaves the test network of the first chain out once a second chain is registered', async () => {
            registerBothChains()

            const { result } = renderHook(
                () =>
                    useAccountValueTotalsQuery(
                        [makeAccount('A1')],
                        TESTNET_SCOPE,
                    ),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))

            expect(result.current.hasFiatTotal).toBe(false)
            expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
        })

        it('has no fiat total for an empty account list on a test-tier scope', () => {
            registerBothChains()

            const { result } = renderHook(
                () => useAccountValueTotalsQuery([], SECOND_CHAIN_TEST_SCOPE),
                { wrapper: createWrapper() },
            )

            expect(result.current.hasFiatTotal).toBe(false)
            expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
        })
    })
})

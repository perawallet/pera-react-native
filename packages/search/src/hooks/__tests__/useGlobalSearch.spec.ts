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

import { beforeEach, describe, test, expect, vi } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useGlobalSearch } from '../useGlobalSearch'

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

const mockAllAccounts = vi.fn<() => WalletAccount[]>()
const mockFindContacts = vi.fn<(args: { keyword: string }) => Contact[]>()
const mockUseOwnedAssets = vi.fn<
    (options?: { enabled?: boolean }) => {
        assets: PeraAsset[]
        isLoading: boolean
    }
>()
const mockUseAssetSearchQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAllAccounts(),
        useOwnedAssets: (options?: { enabled?: boolean }) =>
            mockUseOwnedAssets(options),
    }
})

vi.mock('@perawallet/wallet-core-assets', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-assets')
    >('@perawallet/wallet-core-assets')
    return {
        ...actual,
        useAssetSearchQuery: (...args: unknown[]) =>
            mockUseAssetSearchQuery(...args),
    }
})

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ findContacts: mockFindContacts }),
}))

const makeAccount = (address: string, name?: string): WalletAccount => ({
    type: AccountTypes.algo25,
    address,
    keyPairId: '',
    name,
})

const makeAsset = (
    assetId: string,
    overrides: Partial<PeraAsset> = {},
): PeraAsset => ({
    assetId,
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal(1000000),
    name: 'Test',
    unitName: 'TST',
    ...overrides,
})

const setOwnedAssets = (assets: PeraAsset[]) => {
    mockUseOwnedAssets.mockReturnValue({ assets, isLoading: false })
}

const mockAssetSearchQuery = (overrides: {
    results: unknown[]
    isLoading: boolean
    isError: boolean
    isPaused: boolean
    hasNextPage: boolean
    isFetchingNextPage: boolean
    fetchNextPage: () => void
}) => mockUseAssetSearchQuery.mockReturnValue(overrides)

beforeEach(() => {
    mockUseAssetSearchQuery.mockReturnValue({
        results: [],
        isLoading: false,
        isError: false,
        isPaused: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
    })
})

describe('useGlobalSearch', () => {
    test('passes through the remote asset query error/paused flags', () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])
        mockAssetSearchQuery({
            results: [],
            isLoading: false,
            isError: true,
            isPaused: false,
            hasNextPage: false,
            isFetchingNextPage: false,
            fetchNextPage: vi.fn(),
        })

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0, scopes: ['assets'] }),
            { wrapper: makeWrapper() },
        )

        expect(result.current.isRemoteError).toBe(true)
        expect(result.current.isRemotePaused).toBe(false)
    })

    test('returns empty results with empty query', () => {
        mockAllAccounts.mockReturnValue([makeAccount('ALICE', 'Alice')])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        expect(result.current.value).toBe('')
        expect(result.current.hasResults).toBe(false)
        expect(result.current.results.accounts).toEqual([])
        expect(result.current.results.contacts).toEqual([])
        expect(result.current.results.assets).toEqual([])
        expect(result.current.results.remoteAssets).toEqual([])
    })

    test('scopes option restricts which sections are populated', async () => {
        const alice = makeAccount('ALICE_ADDR', 'Alice')
        mockAllAccounts.mockReturnValue([alice])
        mockFindContacts.mockReturnValue([
            { name: 'Alice Contact', address: 'CONTACT_ADDR' },
        ])
        setOwnedAssets([
            makeAsset('1', { name: 'Alice Asset', unitName: 'ALI' }),
        ])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0, scopes: ['assets'] }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('alice')
        })

        await waitFor(() => {
            expect(result.current.results.assets).toHaveLength(1)
        })
        expect(result.current.results.accounts).toEqual([])
        expect(result.current.results.contacts).toEqual([])
    })

    test('assetFilter narrows the local asset set before matching', async () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        const nft = makeAsset('1', { name: 'PeraFriend NFT', unitName: 'PF' })
        const fungible = makeAsset('2', { name: 'PeraCoin', unitName: 'PC' })
        setOwnedAssets([nft, fungible])

        const { result } = renderHook(
            () =>
                useGlobalSearch({
                    debounceMs: 0,
                    scopes: ['assets'],
                    assetFilter: a => a.assetId === '1',
                }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('pera')
        })

        await waitFor(() =>
            expect(result.current.results.assets.map(a => a.name)).toEqual([
                'PeraFriend NFT',
            ]),
        )
    })

    test('remote asset search is disabled by default (enabled=false)', () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])

        renderHook(() => useGlobalSearch({ debounceMs: 0 }), {
            wrapper: makeWrapper(),
        })

        expect(mockUseAssetSearchQuery).toHaveBeenCalled()
        const lastCall =
            mockUseAssetSearchQuery.mock.calls[
                mockUseAssetSearchQuery.mock.calls.length - 1
            ]
        expect(lastCall?.[1]?.enabled).toBe(false)
    })

    test('showOnEmptyQuery runs the remote search with no query and surfaces suggestions', () => {
        mockAllAccounts.mockReturnValue([makeAccount('ALICE', 'Alice')])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])
        const suggestions = [
            {
                assetId: '31566704',
                name: 'USD Coin',
                unitName: 'USDC',
                peraMetadata: {
                    logo: null,
                    verificationTier: 'verified',
                    type: 'standard_asset',
                },
            },
        ]
        mockUseAssetSearchQuery.mockReturnValue({
            results: suggestions,
            isLoading: false,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        })

        const { result } = renderHook(
            () =>
                useGlobalSearch({
                    debounceMs: 0,
                    scopes: ['assets'],
                    remoteAssets: { showOnEmptyQuery: true },
                }),
            { wrapper: makeWrapper() },
        )

        const lastCall =
            mockUseAssetSearchQuery.mock.calls[
                mockUseAssetSearchQuery.mock.calls.length - 1
            ]
        expect(lastCall?.[0]).toBe('')
        expect(lastCall?.[1]?.enabled).toBe(true)
        expect(result.current.value).toBe('')
        expect(result.current.results.remoteAssets).toEqual(suggestions)
        expect(result.current.results.accounts).toEqual([])
        expect(result.current.hasResults).toBe(true)
    })

    test('showOnEmptyQuery surfaces the remote loading state for the suggestion fetch', () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])
        mockUseAssetSearchQuery.mockReturnValue({
            results: [],
            isLoading: true,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        })

        const { result } = renderHook(
            () =>
                useGlobalSearch({
                    debounceMs: 0,
                    scopes: ['assets'],
                    remoteAssets: { showOnEmptyQuery: true },
                }),
            { wrapper: makeWrapper() },
        )

        expect(result.current.isLoading).toBe(true)
    })

    test('does not report loading while debouncing a client-side (no remote) query', () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([makeAsset('1', { name: 'USDC', unitName: 'USDC' })])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 100, scopes: ['assets'] }),
            { wrapper: makeWrapper() },
        )

        // Set a query without advancing the debounce timer: value is updated
        // but debouncedValue has not caught up, so isDebouncing is true.
        act(() => {
            result.current.setValue('usd')
        })

        // No remote fetch will run for a purely in-memory filter, so the
        // debounce window must not be reported as loading (otherwise the
        // consumer flashes its skeleton on every keystroke).
        expect(result.current.value).toBe('usd')
        expect(result.current.isLoading).toBe(false)
    })

    test('remoteAssets option surfaces backend search results', async () => {
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])
        const remote = [
            {
                assetId: '999',
                name: 'Remote NFT',
                unitName: undefined,
                peraMetadata: {
                    verificationTier: 'verified',
                    type: 'collectible',
                    collectible: {
                        title: 'Remote NFT',
                        collection: { name: 'Remote Collection' },
                    },
                },
            },
        ]
        const fetchNextPage = vi.fn()
        mockUseAssetSearchQuery.mockReturnValue({
            results: remote,
            isLoading: false,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: true,
            fetchNextPage,
        })

        const { result } = renderHook(
            () =>
                useGlobalSearch({
                    debounceMs: 0,
                    scopes: ['assets'],
                    remoteAssets: { hasCollectible: true },
                }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('remote')
        })

        await waitFor(() =>
            expect(result.current.results.remoteAssets).toEqual(remote),
        )
        expect(result.current.hasResults).toBe(true)
        expect(result.current.hasNextRemotePage).toBe(true)

        result.current.fetchNextRemotePage()
        expect(fetchNextPage).toHaveBeenCalled()
    })

    test('matches accounts by name or address (case-insensitive)', async () => {
        const alice = makeAccount('ALICE_ADDR', 'Alice')
        const bob = makeAccount('BOB_ADDR', 'Bob')
        mockAllAccounts.mockReturnValue([alice, bob])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('alice')
        })

        await waitFor(() =>
            expect(result.current.results.accounts).toEqual([alice]),
        )
        expect(result.current.hasResults).toBe(true)
    })

    test('matches contacts via findContacts', async () => {
        mockAllAccounts.mockReturnValue([])
        const charlie: Contact = { name: 'Charlie', address: 'CHAR_ADDR' }
        mockFindContacts.mockImplementation(({ keyword }) =>
            keyword.toLowerCase() === 'char' ? [charlie] : [],
        )
        setOwnedAssets([])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('char')
        })

        await waitFor(() =>
            expect(result.current.results.contacts).toEqual([charlie]),
        )
    })

    test('matches assets on owned holdings across accounts', async () => {
        mockAllAccounts.mockReturnValue([makeAccount('A1')])
        mockFindContacts.mockReturnValue([])
        const usdc = makeAsset('31566704', {
            name: 'USD Coin',
            unitName: 'USDC',
        })
        const goBtc = makeAsset('386195940', {
            name: 'goBTC',
            unitName: 'goBTC',
        })
        setOwnedAssets([usdc, goBtc])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('usd')
        })

        await waitFor(() =>
            expect(result.current.results.assets).toEqual([usdc]),
        )
    })

    test('returns multiple sections simultaneously when all match', async () => {
        const alice = makeAccount('ALICEADDR', 'Alice')
        mockAllAccounts.mockReturnValue([alice])
        const aliceContact: Contact = {
            name: 'Alice Contact',
            address: 'ALICECONTACTADDR',
        }
        mockFindContacts.mockReturnValue([aliceContact])
        const aliceAsset = makeAsset('1', {
            name: 'Alice Token',
            unitName: 'ALICE',
        })
        setOwnedAssets([aliceAsset])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('alice')
        })

        await waitFor(() => {
            expect(result.current.results.accounts).toHaveLength(1)
            expect(result.current.results.contacts).toHaveLength(1)
            expect(result.current.results.assets).toHaveLength(1)
        })
        expect(result.current.hasResults).toBe(true)
    })

    test('sorts each section alphabetically (case-insensitive)', async () => {
        const zara = makeAccount('ADDR_Z', 'Zara')
        const alpha = makeAccount('ADDR_A', 'alpha')
        const mia = makeAccount('ADDR_M', 'Mia')
        mockAllAccounts.mockReturnValue([zara, alpha, mia])
        mockFindContacts.mockReturnValue([])
        const apple = makeAsset('1', { name: 'Apple', unitName: 'APL' })
        const banana = makeAsset('2', { name: 'banana', unitName: 'BAN' })
        const carrot = makeAsset('3', { name: 'Carrot', unitName: 'CAR' })
        setOwnedAssets([carrot, apple, banana])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            {
                wrapper: makeWrapper(),
            },
        )

        await act(async () => {
            result.current.setValue('a')
        })

        await waitFor(() => {
            expect(result.current.results.accounts.map(a => a.name)).toEqual([
                'alpha',
                'Mia',
                'Zara',
            ])
            expect(result.current.results.assets.map(a => a.name)).toEqual([
                'Apple',
                'banana',
                'Carrot',
            ])
        })
    })

    test('returns hasResults=false when nothing matches', async () => {
        mockAllAccounts.mockReturnValue([makeAccount('A', 'Alice')])
        mockFindContacts.mockReturnValue([])
        setOwnedAssets([makeAsset('1', { name: 'USDC', unitName: 'USDC' })])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        await act(async () => {
            result.current.setValue('zzz')
        })

        await waitFor(() => {
            expect(result.current.value).toBe('zzz')
            expect(result.current.hasResults).toBe(false)
        })
    })
})

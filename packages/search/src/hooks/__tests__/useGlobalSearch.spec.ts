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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    AccountHoldingSource,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useGlobalSearch } from '../useGlobalSearch'

const ALGO_SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE_SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }

const REGISTERED: ChainId[] = ['algorand', 'ethereum', 'base']
const DISPLAY_NAMES: Record<string, string> = {
    algorand: 'Algorand',
    ethereum: 'Ethereum',
    base: 'Base',
}
const FAMILIES: Record<string, string> = {
    algorand: 'algorand',
    ethereum: 'evm',
    base: 'evm',
}

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

type HoldingRow = { assetId: string; scope: ChainScope; asset: PeraAsset }

const mockAllAccounts = vi.fn<() => WalletAccount[]>()
const mockFindContacts =
    vi.fn<(args: { keyword: string; family?: string }) => Contact[]>()
const mockWalletSources = vi.fn<() => AccountHoldingSource[]>()
const mockAssetsQuery = vi.fn<
    (
        sources: readonly AccountHoldingSource[],
        options: { search?: string; enabled?: boolean },
    ) => {
        holdings: HoldingRow[]
        isPending: boolean
        isPlaceholderData: boolean
    }
>()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAllAccounts(),
        useRegisteredChainIds: () => REGISTERED,
        useWalletHoldingSources: () => mockWalletSources(),
        useAccountAssetsQuery: (
            sources: readonly AccountHoldingSource[],
            options: { search?: string; enabled?: boolean },
        ) => mockAssetsQuery(sources, options),
        assetFromHoldingLiteRow: (row: HoldingRow) => row.asset,
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) => DISPLAY_NAMES[chainId],
    getChainDescriptor: (chainId: string) => ({ family: FAMILIES[chainId] }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ findContacts: mockFindContacts }),
}))

const makeAccount = (
    address: string,
    name?: string,
    extraChains: WalletAccount['chains'] = {},
): WalletAccount => ({
    id: address,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address, keyPairId: '' }, ...extraChains },
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

const holding = (
    asset: PeraAsset,
    scope: ChainScope = ALGO_SCOPE,
): HoldingRow => ({ assetId: asset.assetId, scope, asset })

const setHoldings = (holdings: HoldingRow[]) => {
    mockAssetsQuery.mockReturnValue({
        holdings,
        isPending: false,
        isPlaceholderData: false,
    })
}

// The real query is only pending while it is enabled.
const setPendingHoldings = () => {
    mockAssetsQuery.mockImplementation((_sources, { enabled }) => ({
        holdings: [],
        isPending: enabled === true,
        isPlaceholderData: false,
    }))
}

const search = async (
    options: Parameters<typeof useGlobalSearch>[0],
    query: string,
) => {
    const hook = renderHook(
        () => useGlobalSearch({ debounceMs: 0, ...options }),
        { wrapper: makeWrapper() },
    )
    await act(async () => {
        hook.result.current.setValue(query)
    })
    return hook
}

describe('useGlobalSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllAccounts.mockReturnValue([])
        mockFindContacts.mockReturnValue([])
        mockWalletSources.mockReturnValue([])
        setHoldings([])
    })

    test('returns empty results with empty query', () => {
        mockAllAccounts.mockReturnValue([makeAccount('ALICE', 'Alice')])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        expect(result.current.value).toBe('')
        expect(result.current.hasResults).toBe(false)
        expect(result.current.results.accounts).toEqual([])
        expect(result.current.results.contacts).toEqual([])
        expect(result.current.results.assets).toEqual([])
    })

    test('scopes option restricts which sections are populated', async () => {
        mockAllAccounts.mockReturnValue([makeAccount('ALICE_ADDR', 'Alice')])
        mockFindContacts.mockReturnValue([
            { name: 'Alice Contact', addresses: { algorand: 'CONTACT_ADDR' } },
        ] as Contact[])
        setHoldings([holding(makeAsset('1', { name: 'Alice Asset' }))])

        const { result } = await search({ scopes: ['assets'] }, 'alice')

        await waitFor(() => {
            expect(result.current.results.assets).toHaveLength(1)
        })
        expect(result.current.results.accounts).toEqual([])
        expect(result.current.results.contacts).toEqual([])
    })

    test('does not report loading while debouncing a query', () => {
        setPendingHoldings()

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 100, scopes: ['assets'] }),
            { wrapper: makeWrapper() },
        )

        act(() => {
            result.current.setValue('usd')
        })

        expect(result.current.value).toBe('usd')
        expect(result.current.isLoading).toBe(false)
    })

    test('reports loading while the holdings read is pending', async () => {
        setPendingHoldings()

        const { result } = await search({ scopes: ['assets'] }, 'usd')

        await waitFor(() => expect(result.current.isLoading).toBe(true))
    })

    test('matches accounts by name (case-insensitive)', async () => {
        const alice = makeAccount('ALICE_ADDR', 'Alice')
        const bob = makeAccount('BOB_ADDR', 'Bob')
        mockAllAccounts.mockReturnValue([alice, bob])

        const { result } = await search({}, 'ALICE')

        await waitFor(() =>
            expect(result.current.results.accounts).toEqual([
                { account: alice, chainId: 'algorand' },
            ]),
        )
        expect(result.current.hasResults).toBe(true)
    })

    test('an address match carries the chain it matched on', async () => {
        const evm = makeAccount('ALICE_ADDR', 'ETH', {
            ethereum: { address: '0xC3D7BEEF' },
        })
        mockAllAccounts.mockReturnValue([evm])

        const { result } = await search({}, '0xc3')

        await waitFor(() =>
            expect(result.current.results.accounts).toEqual([
                { account: evm, chainId: 'ethereum' },
            ]),
        )
        expect(result.current.query).toBe('0xc3')
    })

    test('a network name lists only the accounts with an address on it', async () => {
        const universal = makeAccount('UNI_ADDR', 'Universal', {
            ethereum: { address: '0xAAAA' },
        })
        const algorandOnly = makeAccount('SOLO_ADDR', 'Solo')
        mockAllAccounts.mockReturnValue([universal, algorandOnly])

        const { result } = await search({}, 'ethereum')

        await waitFor(() =>
            expect(result.current.results.accounts).toEqual([
                { account: universal, chainId: 'ethereum' },
            ]),
        )
    })

    test('lists the chains any account is on, in registry order', () => {
        mockAllAccounts.mockReturnValue([
            makeAccount('A', 'A', { base: { address: '0xB' } }),
            makeAccount('C', 'C', { ethereum: { address: '0xE' } }),
        ])

        const { result } = renderHook(
            () => useGlobalSearch({ debounceMs: 0 }),
            { wrapper: makeWrapper() },
        )

        expect(result.current.chainIds).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
    })

    test('matches contacts via findContacts', async () => {
        const charlie = {
            name: 'Charlie',
            addresses: { algorand: 'CHAR_ADDR' },
        } as Contact
        mockFindContacts.mockImplementation(({ keyword }) =>
            keyword.toLowerCase() === 'char' ? [charlie] : [],
        )

        const { result } = await search({}, 'char')

        await waitFor(() =>
            expect(result.current.results.contacts).toEqual([charlie]),
        )
        expect(mockFindContacts).toHaveBeenCalledWith({
            keyword: 'char',
            family: undefined,
        })
    })

    test('a network filter narrows contacts to that chain family and accounts to that chain', async () => {
        const onEth = makeAccount('UNI', 'Savings', {
            ethereum: { address: '0xAAAA' },
        })
        const algorandOnly = makeAccount('SOLO', 'Savings two')
        mockAllAccounts.mockReturnValue([onEth, algorandOnly])

        const { result } = await search({ chainId: 'ethereum' }, 'sav')

        await waitFor(() =>
            expect(result.current.results.accounts).toEqual([
                { account: onEth, chainId: 'ethereum' },
            ]),
        )
        expect(mockFindContacts).toHaveBeenLastCalledWith({
            keyword: 'sav',
            family: 'evm',
        })
    })

    test('asks the holdings read for the typed term over every wallet source', async () => {
        const sources = [
            { address: 'A', scope: ALGO_SCOPE },
            { address: '0xA', scope: ETH_SCOPE },
        ]
        mockWalletSources.mockReturnValue(sources)

        await search({}, 'eth')

        await waitFor(() =>
            expect(mockAssetsQuery).toHaveBeenLastCalledWith(sources, {
                search: 'eth',
                enabled: true,
            }),
        )
    })

    test('a network filter narrows the asset sources to that chain', async () => {
        mockWalletSources.mockReturnValue([
            { address: 'A', scope: ALGO_SCOPE },
            { address: '0xA', scope: ETH_SCOPE },
            { address: '0xA', scope: BASE_SCOPE },
        ])

        await search({ chainId: 'base' }, 'eth')

        await waitFor(() =>
            expect(mockAssetsQuery).toHaveBeenLastCalledWith(
                [{ address: '0xA', scope: BASE_SCOPE }],
                { search: 'eth', enabled: true },
            ),
        )
    })

    test('does not read holdings without the assets scope or a query', () => {
        renderHook(
            () => useGlobalSearch({ debounceMs: 0, scopes: ['accounts'] }),
            { wrapper: makeWrapper() },
        )

        expect(mockAssetsQuery).toHaveBeenLastCalledWith([], {
            search: '',
            enabled: false,
        })
    })

    test('lists an asset held by two accounts once, and the same coin on two networks twice', async () => {
        const ether = makeAsset('native', { name: 'Ether', unitName: 'ETH' })
        setHoldings([
            holding(ether, ETH_SCOPE),
            holding(ether, ETH_SCOPE),
            holding(ether, BASE_SCOPE),
        ])

        const { result } = await search({}, 'eth')

        await waitFor(() =>
            expect(result.current.results.assets).toEqual([
                { asset: ether, scope: ETH_SCOPE },
                { asset: ether, scope: BASE_SCOPE },
            ]),
        )
    })

    test("holds back the previous term's holdings until the new read lands", async () => {
        mockAssetsQuery.mockReturnValue({
            holdings: [holding(makeAsset('1', { name: 'USDC' }))],
            isPending: false,
            isPlaceholderData: true,
        })

        const { result } = await search({}, 'zzz')

        await waitFor(() => expect(result.current.isLoading).toBe(true))
        expect(result.current.results.assets).toEqual([])
    })

    test('leaves out a holding whose metadata has not synced', async () => {
        setHoldings([
            { assetId: '9', scope: ALGO_SCOPE, asset: null as never },
            holding(makeAsset('1', { name: 'USDC' })),
        ])

        const { result } = await search({}, 'u')

        await waitFor(() =>
            expect(
                result.current.results.assets.map(a => a.asset.assetId),
            ).toEqual(['1']),
        )
    })

    test('sorts each section alphabetically (case-insensitive)', async () => {
        mockAllAccounts.mockReturnValue([
            makeAccount('ADDR_Z', 'Zara'),
            makeAccount('ADDR_A', 'alpha'),
            makeAccount('ADDR_M', 'Mia'),
        ])
        setHoldings([
            holding(makeAsset('3', { name: 'Carrot' })),
            holding(makeAsset('1', { name: 'Apple' })),
            holding(makeAsset('2', { name: 'banana' })),
        ])

        const { result } = await search({}, 'a')

        await waitFor(() => {
            expect(
                result.current.results.accounts.map(r => r.account.name),
            ).toEqual(['alpha', 'Mia', 'Zara'])
            expect(
                result.current.results.assets.map(r => r.asset.name),
            ).toEqual(['Apple', 'banana', 'Carrot'])
        })
    })

    test('returns hasResults=false when nothing matches', async () => {
        mockAllAccounts.mockReturnValue([makeAccount('A', 'Alice')])

        const { result } = await search({}, 'zzz')

        await waitFor(() => {
            expect(result.current.value).toBe('zzz')
            expect(result.current.hasResults).toBe(false)
        })
    })
})

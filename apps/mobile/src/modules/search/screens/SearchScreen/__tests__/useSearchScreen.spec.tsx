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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PeraAssetType, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

import { useSearchScreen } from '../useSearchScreen'

const {
    mockNavigate,
    mockResolveAssetHolderAddress,
    mockSetSelectedAccountAddress,
    mockSearchResults,
    mockWindowDimensions,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockResolveAssetHolderAddress: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
    mockSearchResults: vi.fn(),
    mockWindowDimensions: vi.fn(),
}))

vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<typeof import('react-native')>()),
    useWindowDimensions: mockWindowDimensions,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccountAddress: () => ({
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    useResolveAssetHolderAddress: () => mockResolveAssetHolderAddress,
}))

vi.mock('@perawallet/wallet-core-search', () => ({
    SEARCH_SCOPES: ['accounts', 'contacts', 'assets'],
    useGlobalSearch: () => ({
        value: '',
        setValue: vi.fn(),
        results: mockSearchResults(),
        hasResults: false,
        isLoading: false,
    }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ setSelectedContact: vi.fn() }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))

const asset = (type?: PeraAssetType): PeraAsset =>
    ({
        assetId: '31566704',
        peraMetadata: type ? { type } : undefined,
    }) as PeraAsset

const assets = (count: number): PeraAsset[] =>
    Array.from({ length: count }, (_, i) => ({ assetId: `${i}` }) as PeraAsset)

const accounts = (count: number): WalletAccount[] =>
    Array.from(
        { length: count },
        (_, i) => ({ address: `ADDR${i}` }) as WalletAccount,
    )

const setResults = (results: {
    accounts?: WalletAccount[]
    assets?: PeraAsset[]
}) => {
    mockSearchResults.mockReturnValue({
        accounts: results.accounts ?? [],
        contacts: [],
        assets: results.assets ?? [],
        remoteAssets: [],
    })
}

const countRows = (
    rows: ReturnType<typeof useSearchScreen>['rows'],
    type: string,
) => rows.filter(row => row.type === type).length

describe('useSearchScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockResolveAssetHolderAddress.mockResolvedValue(null)
        // 560pt / 56pt rows = a 10-row budget.
        mockWindowDimensions.mockReturnValue({ height: 560, fontScale: 1 })
        setResults({})
    })

    it('fills the screen when a single section has results', () => {
        setResults({ assets: assets(21) })

        const { result } = renderHook(() => useSearchScreen())

        expect(countRows(result.current.rows, 'asset')).toBe(10)
        expect(result.current.rows.at(-1)).toMatchObject({
            type: 'show_more',
            kind: 'assets',
            hiddenCount: 11,
        })
    })

    it('omits show-more when every result fits on screen', () => {
        setResults({ assets: assets(8) })

        const { result } = renderHook(() => useSearchScreen())

        expect(countRows(result.current.rows, 'asset')).toBe(8)
        expect(countRows(result.current.rows, 'show_more')).toBe(0)
    })

    it('gives the unused rows of a short section to the others', () => {
        setResults({ accounts: accounts(2), assets: assets(21) })

        const { result } = renderHook(() => useSearchScreen())

        expect(countRows(result.current.rows, 'account')).toBe(2)
        expect(countRows(result.current.rows, 'asset')).toBe(8)
    })

    it('never shows fewer than five rows per section on a short screen', () => {
        mockWindowDimensions.mockReturnValue({ height: 280, fontScale: 1 })
        setResults({ accounts: accounts(10), assets: assets(10) })

        const { result } = renderHook(() => useSearchScreen())

        expect(countRows(result.current.rows, 'account')).toBe(5)
        expect(countRows(result.current.rows, 'asset')).toBe(5)
    })

    it('shrinks the budget as the font scale grows', () => {
        mockWindowDimensions.mockReturnValue({ height: 560, fontScale: 2 })
        setResults({ assets: assets(21) })

        const { result } = renderHook(() => useSearchScreen())

        expect(countRows(result.current.rows, 'asset')).toBe(5)
    })

    it('shows every result in a section once expanded', () => {
        setResults({ assets: assets(21) })
        const { result } = renderHook(() => useSearchScreen())

        act(() => result.current.onExpandSection('assets'))

        expect(countRows(result.current.rows, 'asset')).toBe(21)
        expect(countRows(result.current.rows, 'show_more')).toBe(0)
    })

    it('routes a collectible result to the collectible detail screen', async () => {
        const { result } = renderHook(() => useSearchScreen())

        await result.current.onAssetPress(asset(PeraAssetType.collectible))

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'CollectibleDetails',
                params: { assetId: '31566704' },
            },
        })
    })

    it('routes a fungible result to the asset detail screen', async () => {
        const { result } = renderHook(() => useSearchScreen())

        await result.current.onAssetPress(asset(PeraAssetType.standard_asset))

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '31566704' },
            },
        })
    })

    it('selects the holding account before opening the detail screen', async () => {
        mockResolveAssetHolderAddress.mockResolvedValue('HOLDER_ADDRESS')
        const { result } = renderHook(() => useSearchScreen())

        await result.current.onAssetPress(asset(PeraAssetType.collectible))

        expect(mockResolveAssetHolderAddress).toHaveBeenCalledWith('31566704')
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'HOLDER_ADDRESS',
        )
        expect(
            mockSetSelectedAccountAddress.mock.invocationCallOrder[0],
        ).toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
    })

    it('leaves the selected account alone when no account holds the asset', async () => {
        const { result } = renderHook(() => useSearchScreen())

        await result.current.onAssetPress(asset(PeraAssetType.standard_asset))

        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalled()
    })
})

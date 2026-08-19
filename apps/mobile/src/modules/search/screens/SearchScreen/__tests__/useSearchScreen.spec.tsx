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
import { renderHook } from '@testing-library/react'
import { PeraAssetType, type PeraAsset } from '@perawallet/wallet-core-assets'

import { useSearchScreen } from '../useSearchScreen'

const {
    mockNavigate,
    mockResolveAssetHolderAddress,
    mockSetSelectedAccountAddress,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockResolveAssetHolderAddress: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
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
        results: { accounts: [], contacts: [], assets: [], remoteAssets: [] },
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

describe('useSearchScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockResolveAssetHolderAddress.mockResolvedValue(null)
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

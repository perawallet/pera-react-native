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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute } from '@react-navigation/native'
import type { PeraProject } from '@perawallet/wallet-core-projects'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useDiscoverChainIds } from '../../../hooks/useDiscoverChainIds'
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverDappsScreen } from '../useDiscoverDappsScreen'

const mockOpenURL = vi.fn()
vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<object>()),
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
}))
vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useRoute: vi.fn(),
}))
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('@modules/bottom-sheet', () => ({ useBottomSheet: vi.fn() }))
vi.mock('../../../hooks/useDiscoverChainIds', () => ({
    useDiscoverChainIds: vi.fn(),
}))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const navigate = vi.fn()
const openDapp = vi.fn()
const refetch = vi.fn(async () => undefined)
const request = vi.fn(async () => undefined)

const project = (
    name: string,
    over: Partial<PeraProject> = {},
): PeraProject => ({
    name,
    url: `https://${name.toLowerCase()}.example`,
    chains: [],
    ...over,
})

const PROJECTS: PeraProject[] = [
    project('Tinyman', {
        popularityScore: 5,
        categories: [{ id: 'dex', title: 'DEX' }],
    }),
    project('Folks', {
        popularityScore: 9,
        categories: [{ id: 'lend', title: 'Lending' }],
    }),
    project('Aave', {
        popularityScore: 1,
        chains: ['eip155:1'],
        categories: [{ id: 'lend', title: 'Lending' }],
    }),
]

const mockDirectory = (projects: PeraProject[] = PROJECTS) =>
    vi.mocked(useDiscoverDirectory).mockReturnValue({
        projects,
        verifiedUrls: new Set(),
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch,
    })

const names = (result: {
    current: ReturnType<typeof useDiscoverDappsScreen>
}) => result.current.items.map(item => item.dapp.name)

const setup = () => renderHook(() => useDiscoverDappsScreen())

describe('useDiscoverDappsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerEthereumChain()
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never)
        vi.mocked(useBottomSheet).mockReturnValue({ request } as never)
        vi.mocked(useRoute).mockReturnValue({ params: undefined } as never)
        vi.mocked(useDiscoverChainIds).mockReturnValue(['algorand', 'ethereum'])
        vi.mocked(useOpenDapp).mockReturnValue({
            openDapp,
            openWebPage: vi.fn(),
        })
        mockDirectory()
    })
    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('starts on All with every dApp by popularity and chain icons on rows', () => {
        const { result } = setup()
        expect(result.current.selectedChainId).toBeNull()
        expect(result.current.chainOptions.map(o => o.value)).toEqual([
            null,
            'algorand',
            'ethereum',
        ])
        expect(names(result)).toEqual(['Folks', 'Tinyman', 'Aave'])
        expect(result.current.showChains).toBe(true)
    })

    it('opens on the chain the home passed when it supports Discover', () => {
        vi.mocked(useRoute).mockReturnValue({
            params: { chainId: 'ethereum' },
        } as never)
        const { result } = setup()
        expect(result.current.selectedChainId).toBe('ethereum')
        expect(names(result)).toEqual(['Aave'])
        expect(result.current.showChains).toBe(false)
    })

    it('falls back to All for a chain without Discover', () => {
        vi.mocked(useRoute).mockReturnValue({
            params: { chainId: 'base' },
        } as never)
        const { result } = setup()
        expect(result.current.selectedChainId).toBeNull()
    })

    it('selectChain filters and tracks the chain name', () => {
        const { result } = setup()
        act(() => result.current.selectChain('ethereum'))
        expect(names(result)).toEqual(['Aave'])
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.DappFilterTap, {
            filter_name: 'Ethereum',
            chain_id: 'ethereum',
        })
    })

    it('selectSort reorders, resets the category and tracks the English label', () => {
        const { result } = setup()
        act(() => result.current.selectCategory('Lending'))
        act(() => result.current.selectSort('a-z'))
        expect(result.current.sort).toBe('a-z')
        expect(result.current.selectedCategory).toBeNull()
        expect(names(result)).toEqual(['Aave', 'Folks', 'Tinyman'])
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFilterTap,
            { filter_name: 'Alphabetical (A-Z)' },
        )
    })

    it('selectCategory filters and tracks the web category event', () => {
        const { result } = setup()
        act(() => result.current.selectCategory('DEX'))
        expect(names(result)).toEqual(['Tinyman'])
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.DappCategoryTap, {
            category_name: 'DEX',
        })
    })

    it('sort and category events carry the selected chain', () => {
        const { result } = setup()
        act(() => result.current.selectChain('ethereum'))
        act(() => result.current.selectCategory('Lending'))
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappCategoryTap,
            { category_name: 'Lending', chain_id: 'ethereum' },
        )
        act(() => result.current.selectSort('a-z'))
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFilterTap,
            { filter_name: 'Alphabetical (A-Z)', chain_id: 'ethereum' },
        )
    })

    it('a category hidden by a chain switch does not come back on its own', () => {
        const { result } = setup()
        act(() => result.current.selectCategory('DEX'))
        act(() => result.current.selectChain('ethereum'))
        act(() => result.current.selectChain(null))
        expect(result.current.selectedCategory).toBeNull()
        expect(names(result)).toEqual(['Folks', 'Tinyman', 'Aave'])
    })

    it('shows loading while a retry after an error is in flight', () => {
        vi.mocked(useDiscoverDirectory).mockReturnValue({
            projects: [],
            verifiedUrls: new Set(),
            isLoading: false,
            isError: true,
            isFetching: true,
            refetch,
        })
        const { result } = setup()
        expect(result.current.isLoading).toBe(true)
        expect(result.current.isError).toBe(false)
    })

    it('offers All plus the categories of the chain-filtered list', () => {
        const { result } = setup()
        expect(result.current.categoryOptions.map(o => o.value)).toEqual([
            null,
            'Lending',
            'DEX',
        ])
        act(() => result.current.selectChain('ethereum'))
        expect(result.current.categoryOptions.map(o => o.value)).toEqual([
            null,
            'Lending',
        ])
    })

    it('drops a category that the new chain does not have', () => {
        const { result } = setup()
        act(() => result.current.selectCategory('DEX'))
        act(() => result.current.selectChain('ethereum'))
        expect(result.current.selectedCategory).toBeNull()
        expect(names(result)).toEqual(['Aave'])
    })

    it('has no items when no chain supports Discover', () => {
        vi.mocked(useDiscoverChainIds).mockReturnValue([])
        mockDirectory([])
        const { result } = setup()
        expect(result.current.items).toEqual([])
        expect(result.current.chainOptions).toEqual([])
    })

    it('applyForDiscover opens the verification page in the system browser', () => {
        const { result } = setup()
        act(() => result.current.applyForDiscover())
        expect(mockOpenURL).toHaveBeenCalledWith(
            'https://explorer.perawallet.app/project-verification/',
        )
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.ApplyForVerificationTap,
            { category: 'project' },
        )
    })

    it('openSearch opens the native search', () => {
        const { result } = setup()
        act(() => result.current.openSearch())
        expect(navigate).toHaveBeenCalledWith('DiscoverSearch')
    })

    it('openDapp opens the dApp with the selected chain', () => {
        const { result } = setup()
        act(() => result.current.selectChain('ethereum'))
        const dapp = result.current.items[0]!.dapp
        act(() => result.current.openDapp(dapp))
        expect(openDapp).toHaveBeenCalledWith(dapp, 'ethereum')
    })

    it('retry refetches the directory', () => {
        const { result } = setup()
        act(() => result.current.retry())
        expect(refetch).toHaveBeenCalled()
    })

    it('openDetails opens a content-sized sheet for the dApp on the selected chain', async () => {
        const { result } = setup()
        act(() => result.current.selectChain('ethereum'))
        const item = result.current.items[0]!
        await act(async () => result.current.openDetails(item))
        expect(request).toHaveBeenCalledTimes(1)
        const [call] = request.mock.calls[0] as unknown as [
            { contents: { props: Record<string, unknown> }; options: object },
        ]
        expect(call.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
        expect(call.contents.props).toEqual({
            item,
            chainId: 'ethereum',
            isVerified: false,
        })
    })

    it('a sheet closed without Open tracks the web close event', async () => {
        request.mockResolvedValueOnce(undefined)
        const { result } = setup()
        const { openDetails, items } = result.current
        await act(async () => openDetails(items[0]!))
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DetailsCloseTap,
            { dapp_name: 'Folks' },
        )
    })

    it('a sheet left through Open tracks no close', async () => {
        request.mockResolvedValueOnce('open' as never)
        const { result } = setup()
        const { openDetails, items } = result.current
        await act(async () => openDetails(items[0]!))
        expect(trackEvent).not.toHaveBeenCalledWith(
            DiscoverEvent.DetailsCloseTap,
            expect.anything(),
        )
    })
})

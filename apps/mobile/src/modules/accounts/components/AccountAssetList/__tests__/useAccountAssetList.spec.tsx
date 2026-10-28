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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useAccountAssetList } from '../useAccountAssetList'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    setCapabilityOverrides,
    setChainEnabled,
} from '@test-utils/capability-overrides'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { registerEthereumAccountsAdapter } from '@test-utils/ethereumAccountsAdapter'
import {
    useAccountAssetsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isCollectible, type AssetGroup } from '@perawallet/wallet-core-assets'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { AnalyticsMetadataKey, AssetDetailsEvent } from '@analytics'
import { useAssetListViewStore } from '../../../hooks/useAssetListViewStore'

const mockAccount: WalletAccount = {
    id: 'test-account',
    name: 'Test Account',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'test-address' } },
}

const mockT = (key: string) => key

const { mockNavigate, mockTrackEvent } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockTrackEvent: vi.fn(),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    createNavigationContainerRef: () => ({
        isReady: () => false,
        navigate: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        current: null,
    }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

const ALGORAND_MAINNET: ChainScope = {
    chainId: 'algorand',
    networkId: 'mainnet',
}
const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}

const ETH_ADDRESS = `0x${'a'.repeat(40)}`

const twoChainAccount: WalletAccount = {
    id: 'two-chains',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'test-address' },
        ethereum: { address: ETH_ADDRESS },
    },
}

const makeHolding = (assetId: string, scope = ALGORAND_MAINNET) => ({
    scope,
    assetId,
    amount: new Decimal(0),
    decimals: null,
    chainData: null,
    totalSupply: null,
    name: null,
    unitName: null,
    url: null,
    metadata: null,
    peraMetadataJson: null,
    isFavorited: false,
    usdPrice: null,
    crossChainAssetGroupId: null,
})

const USDC_GROUP: AssetGroup = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

const makeGroupedHolding = (assetId: string, scope = ALGORAND_MAINNET) => ({
    ...makeHolding(assetId, scope),
    decimals: 6,
    totalSupply: '0',
    peraMetadataJson: JSON.stringify({
        isDeleted: false,
        verificationTier: 'verified',
        crossChainAssetGroup: USDC_GROUP,
    }),
    crossChainAssetGroupId: USDC_GROUP.id,
})

const { mockAssetsQuery, mockPreferences } = vi.hoisted(() => ({
    mockAssetsQuery: {
        holdings: [] as unknown[],
        isPending: false,
        isPlaceholderData: false,
    },
    mockPreferences: { assetSortMode: 'balanceDesc' },
}))

// Watch accounts sign nothing; a test flips this to reach the swipe rules.
const mockCanSign = vi.hoisted(() => ({ current: false }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useCanSignWith: () => mockCanSign.current,
        useAccountAssetsQuery: vi.fn(() => ({
            holdings: mockAssetsQuery.holdings,
            isPending: mockAssetsQuery.isPending,
            isPlaceholderData: mockAssetsQuery.isPlaceholderData,
            isError: false,
            isRefetching: false,
        })),
    }
})

const { mockOptOut } = vi.hoisted(() => ({
    mockOptOut: vi.fn().mockResolvedValue({ txIds: ['tx1'] }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: mockOptOut,
        isLoading: false,
    }),
}))

const { mockShowToast, mockShowError } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

const NATIVE_ASSET = vi.hoisted(() => ({
    assetId: '0',
    unitName: 'ALGO',
    decimals: 6,
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useIsNativeAssetId: () => (id: unknown) =>
            id != null && String(id) === NATIVE_ASSET.assetId,
        useNativeAsset: () => NATIVE_ASSET,
        nativeAssetFor: () => NATIVE_ASSET,
        findNativeAsset: (chainId: string) =>
            chainId === 'algorand'
                ? NATIVE_ASSET
                : chainId === 'ethereum'
                  ? { ...NATIVE_ASSET, assetId: 'native' }
                  : undefined,
        isNativeAssetId: (_chainId: string, assetId: string) =>
            assetId === NATIVE_ASSET.assetId,
        useAssetPreferencesStore: vi.fn(
            (selector: (state: unknown) => unknown) =>
                selector({
                    hideZeroBalance: false,
                    displayNfts: true,
                    displayOptedInNfts: true,
                    assetSortMode: mockPreferences.assetSortMode,
                }),
        ),
        isCollectible: vi.fn(() => false),
    }
})

vi.mock('@constants/ui', async () => {
    const actual =
        await vi.importActual<typeof import('@constants/ui')>('@constants/ui')
    return {
        ...actual,
        SEARCH_DEBOUNCE_TIME_SHORT: 150,
        SHORT_PROMPT_DISPLAY_DELAY: 300,
        LONG_PROMPT_DISPLAY_DELAY: 600,
    }
})

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useAccountAssetList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAccountsAdapter()
        useRemoteConfigStore.getState().resetState()
        mockAssetsQuery.holdings = [makeHolding('123')]
        mockAssetsQuery.isPending = false
        mockAssetsQuery.isPlaceholderData = false
        mockPreferences.assetSortMode = 'balanceDesc'
        mockCanSign.current = false
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    afterEach(() => {
        act(() => useNetworkStore.getState().setMode('live'))
    })

    const registerEthereum = () => {
        registerEthereumChain()
        registerEthereumAccountsAdapter()
    }

    const lastQuerySources = () =>
        vi.mocked(useAccountAssetsQuery).mock.lastCall?.[0]

    it('offers asset management only while the manageAssets capability is on', () => {
        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )
        expect(result.current.canManageAssets).toBe(true)
        expect(result.current.renderItemProps.canManageAssets).toBe(true)

        act(() => setCapabilityOverrides({ manageAssets: false }))

        expect(result.current.canManageAssets).toBe(false)
        expect(result.current.renderItemProps.canManageAssets).toBe(false)
    })

    it("lists no holdings and no management while the account's chain is switched off", () => {
        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )
        expect(result.current.items).toHaveLength(1)

        act(() => setChainEnabled('algorand', false))

        expect(result.current.isChainSwitchedOff).toBe(true)
        expect(result.current.items).toEqual([])
        expect(result.current.canManageAssets).toBe(false)
    })

    it("reads an Ethereum account's holdings on Ethereum", () => {
        registerEthereum()
        const ethAccount: WalletAccount = {
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: ETH_ADDRESS } },
        }

        const { result } = renderHook(() =>
            useAccountAssetList({ account: ethAccount, t: mockT }),
        )

        expect(lastQuerySources()).toEqual([
            { address: ETH_ADDRESS, scope: ETHEREUM_MAINNET },
        ])
        expect(result.current.canManageAssets).toBe(false)
    })

    it("opens a holding's detail screen on the holding's own chain", () => {
        registerEthereum()
        const { result } = renderHook(() =>
            useAccountAssetList({ account: twoChainAccount, t: mockT }),
        )

        act(() =>
            result.current.goToAssetScreen(
                makeHolding('0xabc', ETHEREUM_MAINNET),
            ),
        )

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
            assetId: '0xabc',
            chainId: 'ethereum',
        })
    })

    it('tracks opening add and manage assets on algorand', () => {
        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        act(() => {
            result.current.handleOpenAddAsset()
            result.current.handleOpenManage()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            AssetDetailsEvent.AddAsset,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            AssetDetailsEvent.ManageAsset,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    it("tracks opening add and manage assets on an Ethereum account's chain", () => {
        registerEthereum()
        const ethAccount: WalletAccount = {
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: ETH_ADDRESS } },
        }
        const { result } = renderHook(() =>
            useAccountAssetList({ account: ethAccount, t: mockT }),
        )

        act(() => {
            result.current.handleOpenAddAsset()
            result.current.handleOpenManage()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            AssetDetailsEvent.AddAsset,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            AssetDetailsEvent.ManageAsset,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
    })

    describe('collectible routing', () => {
        const collectibleHolding = (scope = ALGORAND_MAINNET) => ({
            ...makeHolding('77', scope),
            decimals: 0,
            totalSupply: '1',
        })

        beforeEach(() => {
            vi.mocked(isCollectible).mockReturnValue(true)
        })

        afterEach(() => {
            vi.mocked(isCollectible).mockReturnValue(false)
        })

        it('opens a collectible on an nft chain in the collectible detail, with its chain', () => {
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            act(() => result.current.goToAssetScreen(collectibleHolding()))

            expect(mockNavigate).toHaveBeenCalledWith('CollectibleDetails', {
                assetId: '77',
                chainId: 'algorand',
            })
        })

        it('opens a collectible in the asset detail while nft is off on its chain', () => {
            act(() => setCapabilityOverrides({ nft: false }))
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            act(() => result.current.goToAssetScreen(collectibleHolding()))

            expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
                assetId: '77',
                chainId: 'algorand',
            })
            expect(mockNavigate).not.toHaveBeenCalledWith(
                'CollectibleDetails',
                expect.anything(),
            )
        })
    })

    describe('loading rows', () => {
        beforeEach(() => {
            mockAssetsQuery.holdings = []
            mockAssetsQuery.isPending = true
        })

        it('lists eight skeleton rows while the holdings read is pending', () => {
            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            expect(result.current.items).toHaveLength(8)
            expect(result.current.items.every(i => i.kind === 'skeleton')).toBe(
                true,
            )
            const ids = result.current.items.map(item =>
                item.kind === 'skeleton' ? item.id : null,
            )
            expect(new Set(ids).size).toBe(8)
        })

        it.each([null, 'algorand', 'ethereum'] as const)(
            'shows skeleton rows for a pending read under %s',
            chainId => {
                registerEthereum()
                const { result } = renderHook(() =>
                    useAccountAssetList({ account: twoChainAccount, t: mockT }),
                )

                act(() => result.current.setSelectedChainId(chainId))

                expect(result.current.selectedChainId).toBe(chainId)
                expect(result.current.items).toHaveLength(8)
                expect(
                    result.current.items.every(i => i.kind === 'skeleton'),
                ).toBe(true)
            },
        )

        it('swaps the skeleton rows for the holdings once they land', () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            mockAssetsQuery.holdings = [makeHolding('123')]
            mockAssetsQuery.isPending = false
            rerender({})

            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
            ])
        })

        it('lists nothing, not skeletons, when every chain is switched off', () => {
            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            act(() => setChainEnabled('algorand', false))

            expect(result.current.items).toEqual([])
        })
    })

    describe('network chips', () => {
        it('offers no chips while the account is on one chain', () => {
            registerEthereum()

            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            expect(result.current.chainFilterOptions).toEqual([])
        })

        it('offers All and one chip per chain the account is on', () => {
            registerEthereum()

            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            expect(
                result.current.chainFilterOptions.map(option => option.value),
            ).toEqual([null, 'algorand', 'ethereum'])
            expect(result.current.chainFilterOptions[0]?.label).toBe(
                'account_details.assets.network_filter_all',
            )
            expect(result.current.selectedChainId).toBeNull()
            expect(lastQuerySources()).toHaveLength(2)
        })

        it('narrows the read to the selected chain and folds no groups', () => {
            registerEthereum()
            mockAssetsQuery.holdings = [
                makeGroupedHolding('0xA0b8', ETHEREUM_MAINNET),
            ]
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            act(() => result.current.setSelectedChainId('ethereum'))

            expect(result.current.selectedChainId).toBe('ethereum')
            expect(lastQuerySources()).toEqual([
                { address: ETH_ADDRESS, scope: ETHEREUM_MAINNET },
            ])
            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
            ])
        })

        it('folds grouped holdings under All', () => {
            registerEthereum()
            mockAssetsQuery.holdings = [
                makeGroupedHolding('31566704'),
                makeGroupedHolding('0xA0b8', ETHEREUM_MAINNET),
            ]

            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            expect(result.current.items.map(item => item.kind)).toEqual([
                'group',
            ])
        })

        it('expands a grouped row to its networks and collapses it again, without navigating', () => {
            registerEthereum()
            mockAssetsQuery.holdings = [
                makeGroupedHolding('31566704'),
                makeGroupedHolding('0xA0b8', ETHEREUM_MAINNET),
            ]
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            act(() => result.current.toggleGroupExpanded('usdc'))

            const memberScopes = result.current.items.flatMap(item =>
                item.kind === 'holding' && item.isGroupMember
                    ? [item.holding.scope.chainId]
                    : [],
            )
            expect(result.current.items[0]?.kind).toBe('group')
            expect(memberScopes).toEqual(['algorand', 'ethereum'])

            act(() => result.current.toggleGroupExpanded('usdc'))

            expect(result.current.items.map(item => item.kind)).toEqual([
                'group',
            ])
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it("opens a group member's detail on that member's own chain", () => {
            registerEthereum()
            mockAssetsQuery.holdings = [
                makeGroupedHolding('31566704'),
                makeGroupedHolding('0xA0b8', ETHEREUM_MAINNET),
            ]
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )
            act(() => result.current.toggleGroupExpanded('usdc'))
            const ethereumMember = result.current.items.find(
                item =>
                    item.kind === 'holding' &&
                    item.isGroupMember &&
                    item.holding.scope.chainId === 'ethereum',
            )
            if (ethereumMember?.kind !== 'holding') {
                throw new Error('expected the Ethereum member row')
            }

            act(() =>
                result.current.renderItemProps.goToAssetScreen(
                    ethereumMember.holding,
                ),
            )

            expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
                assetId: '0xA0b8',
                chainId: 'ethereum',
            })
        })

        it('folds nothing on an account with one chain', () => {
            mockAssetsQuery.holdings = [
                makeGroupedHolding('31566704'),
                makeGroupedHolding('0xA0b8'),
            ]

            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
                'holding',
            ])
        })

        it('never folds holdings on a test network', () => {
            registerEthereum()
            act(() => useNetworkStore.getState().setMode('developer'))
            const algorandTestnet: ChainScope = {
                chainId: 'algorand',
                networkId: 'testnet',
            }
            const ethereumTestnet: ChainScope = {
                chainId: 'ethereum',
                networkId: 'sepolia',
            }
            mockAssetsQuery.holdings = [
                makeGroupedHolding('10458941', algorandTestnet),
                makeGroupedHolding('0x1c7D', ethereumTestnet),
            ]

            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            expect(result.current.items.map(item => item.kind)).toEqual([
                'holding',
                'holding',
            ])
        })

        it('shows All for an account without the selected chain, and keeps the selection', () => {
            registerEthereum()
            useAssetListViewStore.getState().setSelectedChainId('ethereum')

            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )

            expect(result.current.selectedChainId).toBeNull()
            expect(useAssetListViewStore.getState().selectedChainId).toBe(
                'ethereum',
            )
        })

        it('passes the search through to the read', () => {
            registerEthereum()
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            act(() => result.current.setSearchFilter('0xA0'))

            expect(vi.mocked(useAccountAssetsQuery).mock.lastCall?.[1]).toEqual(
                expect.objectContaining({ search: '0xA0' }),
            )
        })

        it("lets only the account's own chain swipe to opt out", () => {
            registerEthereum()
            mockCanSign.current = true
            const { result } = renderHook(() =>
                useAccountAssetList({ account: twoChainAccount, t: mockT }),
            )

            expect(
                result.current.renderItemProps.isSwipeable(makeHolding('123')),
            ).toBe(true)
            expect(
                result.current.renderItemProps.isSwipeable(
                    makeHolding('0xabc', ETHEREUM_MAINNET),
                ),
            ).toBe(false)
            expect(
                result.current.renderItemProps.isSwipeable(makeHolding('0')),
            ).toBe(false)
        })
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockOptOut.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        await act(async () => {
            await result.current.handleOptOut({
                scope: ALGORAND_MAINNET,
                assetId: '123',
                amount: new Decimal(0),
                decimals: null,
                chainData: null,
                totalSupply: null,
                name: null,
                unitName: null,
                url: null,
                metadata: null,
                peraMetadataJson: null,
                isFavorited: false,
                usdPrice: null,
                crossChainAssetGroupId: null,
            })
        })

        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('shows an error toast when opt-out fails with a non-cancel error', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        const optOutError = new Error('Network error')
        mockOptOut.mockRejectedValueOnce(optOutError)

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        await act(async () => {
            await result.current.handleOptOut({
                scope: ALGORAND_MAINNET,
                assetId: '123',
                amount: new Decimal(0),
                decimals: null,
                chainData: null,
                totalSupply: null,
                name: null,
                unitName: null,
                url: null,
                metadata: null,
                peraMetadataJson: null,
                isFavorited: false,
                usdPrice: null,
                crossChainAssetGroupId: null,
            })
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optOutError,
            'asset_opt_out.error',
        )
    })

    // re-sorting or switching account is a new query key, so the rows
    // go through a gap before the new ones land. The reset has to survive it.
    describe('scroll reset when the requested view changes', () => {
        const attachListRef = (result: {
            current: ReturnType<typeof useAccountAssetList>
        }) => {
            const scrollToOffset = vi.fn()
            result.current.listRef.current = {
                scrollToOffset,
                scrollToIndex: vi.fn(),
                scrollToEnd: vi.fn(),
            }
            return scrollToOffset
        }

        const flushFrame = async () => {
            await act(async () => {
                await new Promise(resolve =>
                    requestAnimationFrame(() => resolve(null)),
                )
            })
        }

        it('does not scroll on the first render', async () => {
            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()
        })

        it('scrolls to the top once the rows for a new sort arrive after an empty tick', async () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            mockPreferences.assetSortMode = 'nameAsc'
            mockAssetsQuery.holdings = []
            mockAssetsQuery.isPending = true
            rerender({})
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockAssetsQuery.holdings = [makeHolding('456'), makeHolding('123')]
            mockAssetsQuery.isPending = false
            rerender({})
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: true,
            })
        })

        it('waits for the new order instead of resetting on placeholder rows', async () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            mockPreferences.assetSortMode = 'nameAsc'
            mockAssetsQuery.isPlaceholderData = true
            rerender({})
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockAssetsQuery.isPlaceholderData = false
            mockAssetsQuery.holdings = [makeHolding('456')]
            rerender({})
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })

        // A placeholder gap re-runs the effect, and its cleanup cancels the
        // frame the previous run scheduled. Recording the request as applied
        // before that frame ran made the cancellation permanent.
        it('still resets once the rows land if a placeholder gap cancelled the scheduled frame', async () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            // The new order's rows land and schedule a reset for the next frame.
            mockPreferences.assetSortMode = 'nameAsc'
            mockAssetsQuery.isPlaceholderData = false
            mockAssetsQuery.holdings = [makeHolding('456')]
            rerender({})

            // A refetch re-enters the placeholder gap before that frame runs.
            mockAssetsQuery.isPlaceholderData = true
            rerender({})
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockAssetsQuery.isPlaceholderData = false
            rerender({})
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })

        it('starts a switched-to account at the top without animating', async () => {
            const { result, rerender } = renderHook(
                ({ account }: { account: WalletAccount }) =>
                    useAccountAssetList({ account, t: mockT }),
                { initialProps: { account: mockAccount } },
            )
            const scrollToOffset = attachListRef(result)

            mockAssetsQuery.holdings = [makeHolding('789')]
            rerender({
                account: {
                    ...mockAccount,
                    id: 'other-account',
                    chains: { algorand: { address: 'other-address' } },
                },
            })
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: false,
            })
        })
    })
})

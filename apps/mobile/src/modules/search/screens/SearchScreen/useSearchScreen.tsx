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

import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import {
    type WalletAccount,
    findAccountByAddressOn,
    useAllAccounts,
    useResolveAssetHolderAddress,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import { isCollectible, type PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import {
    SEARCH_SCOPES,
    useGlobalSearch,
    type AccountSearchResult,
    type AssetSearchResult,
    type SearchScope,
} from '@perawallet/wallet-core-search'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapabilityCheck } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import { toChainFilterOptions } from '@modules/assets'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SearchFilterContent } from '../../components/SearchFilterContent'

const MIN_SECTION_LIMIT = 5
// Result rows render ~56pt at fontScale 1. Sizing against the whole window
// rather than the measured list overshoots slightly, which is the point: the
// results should reach past the fold instead of stopping short of it.
const ESTIMATED_ROW_HEIGHT = 56

const allocateSectionLimits = (counts: number[], budget: number): number[] => {
    const limits = counts.map(() => 0)
    let remaining = budget
    while (remaining > 0 && limits.some((limit, i) => limit < counts[i])) {
        for (let i = 0; i < counts.length && remaining > 0; i++) {
            if (limits[i] < counts[i]) {
                limits[i]++
                remaining--
            }
        }
    }
    return limits.map((limit, i) =>
        Math.min(counts[i], Math.max(limit, MIN_SECTION_LIMIT)),
    )
}

export type SearchRow =
    | { type: 'section_header'; kind: SearchScope; key: string }
    | {
          type: 'account'
          account: WalletAccount
          /** The chain the search matched the account on. */
          chainId: Optional<ChainId>
          key: string
      }
    | { type: 'contact'; contact: Contact; key: string }
    | { type: 'asset'; asset: PeraAsset; scope: ChainScope; key: string }
    | {
          type: 'show_more'
          kind: SearchScope
          hiddenCount: number
          key: string
      }

export type UseSearchScreenResult = {
    value: string
    setValue: (text: string) => void
    /** The debounced term the results matched. */
    query: string
    rows: SearchRow[]
    hasResults: boolean
    isLoading: boolean
    scopes: SearchScope[]
    toggleScope: (scope: SearchScope) => void
    /** The network the results are narrowed to; `null` is All. */
    selectedChainId: Nullable<ChainId>
    setSelectedChainId: (chainId: Nullable<ChainId>) => void
    /** Empty while the wallet is on fewer than two networks: nothing to filter. */
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    /** On All, with more than one network to tell apart: each asset row names its network. */
    shouldShowAssetNetwork: boolean
    openFilterSheet: () => void
    onAccountPress: (account: WalletAccount) => void
    onContactPress: (contact: Contact) => void
    onAssetPress: (asset: PeraAsset, scope: ChainScope) => Promise<void>
    onExpandSection: (kind: SearchScope) => void
}

type SectionConfig = {
    kind: SearchScope
    items: Array<AccountSearchResult | Contact | AssetSearchResult>
    toRow: (item: never) => SearchRow
}

export const useSearchScreen = (): UseSearchScreenResult => {
    const { t } = useLanguage()
    const [scopes, setScopes] = useState<SearchScope[]>([...SEARCH_SCOPES])
    const toggleScope = useCallback((scope: SearchScope) => {
        setScopes(prev =>
            prev.includes(scope)
                ? prev.filter(s => s !== scope)
                : [...prev, scope],
        )
    }, [])
    const [selectedChainId, setSelectedChainId] =
        useState<Nullable<ChainId>>(null)
    const { value, setValue, query, results, hasResults, isLoading, chainIds } =
        useGlobalSearch({
            scopes,
            chainId: selectedChainId ?? undefined,
        })
    const chainFilterOptions = useMemo(
        () =>
            toChainFilterOptions(chainIds, {
                allLabel: t('account_details.assets.network_filter_all'),
                testIDPrefix: 'search_network_filter',
            }),
        [chainIds, t],
    )
    const shouldShowAssetNetwork =
        chainFilterOptions.length > 0 && selectedChainId === null
    const navigation = useAppNavigation()
    const { setSelectedAccountId } = useSelectedAccountId()
    const accounts = useAllAccounts()
    const resolveAssetHolderAddress = useResolveAssetHolderAddress()
    const checkCapability = useCapabilityCheck()
    const { setSelectedContact } = useContacts()
    const { request: requestBottomSheet } = useBottomSheet()

    const openFilterSheet = useCallback(() => {
        void requestBottomSheet({
            contents: (
                <SearchFilterContent
                    scopes={scopes}
                    onToggleScope={toggleScope}
                    chainFilterOptions={chainFilterOptions}
                    selectedChainId={selectedChainId}
                    onSelectChain={setSelectedChainId}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [
        requestBottomSheet,
        scopes,
        toggleScope,
        chainFilterOptions,
        selectedChainId,
    ])

    const [expandedSections, setExpandedSections] = useState<
        Record<SearchScope, boolean>
    >({ accounts: false, contacts: false, assets: false })

    const onExpandSection = useCallback((kind: SearchScope) => {
        setExpandedSections(prev => ({ ...prev, [kind]: true }))
    }, [])

    const { height: windowHeight, fontScale = 1 } = useWindowDimensions()
    const rowBudget = Math.ceil(
        windowHeight / (ESTIMATED_ROW_HEIGHT * fontScale),
    )

    const rows = useMemo<SearchRow[]>(() => {
        const sections: SectionConfig[] = [
            {
                kind: 'accounts',
                items: results.accounts,
                toRow: ({ account, chainId }: AccountSearchResult) => ({
                    type: 'account',
                    account,
                    chainId,
                    key: `account-${account.id}`,
                }),
            },
            {
                kind: 'contacts',
                items: results.contacts,
                toRow: (contact: Contact) => ({
                    type: 'contact',
                    contact,
                    key: `contact-${contact.id}`,
                }),
            },
            {
                kind: 'assets',
                items: results.assets,
                toRow: ({ asset, scope }: AssetSearchResult) => ({
                    type: 'asset',
                    asset,
                    scope,
                    key: `asset-${scope.chainId}-${asset.assetId}`,
                }),
            },
        ]

        const limits = allocateSectionLimits(
            sections.map(section => section.items.length),
            rowBudget,
        )

        const out: SearchRow[] = []
        sections.forEach((section, index) => {
            if (section.items.length === 0) return

            out.push({
                type: 'section_header',
                kind: section.kind,
                key: `header-${section.kind}`,
            })

            const isExpanded = expandedSections[section.kind]
            const visible = isExpanded
                ? section.items
                : section.items.slice(0, limits[index])

            for (const item of visible) {
                out.push((section.toRow as (i: unknown) => SearchRow)(item))
            }

            const hiddenCount = section.items.length - visible.length
            if (hiddenCount > 0) {
                out.push({
                    type: 'show_more',
                    kind: section.kind,
                    hiddenCount,
                    key: `show-more-${section.kind}`,
                })
            }
        })

        return out
    }, [results, expandedSections, rowBudget])

    const onAccountPress = useCallback(
        (account: WalletAccount) => {
            setSelectedAccountId(account.id)
            navigation.navigate('TabBar', {
                screen: 'Home',
                params: { screen: 'AccountDetails' },
            })
        },
        [navigation, setSelectedAccountId],
    )

    const onContactPress = useCallback(
        (contact: Contact) => {
            setSelectedContact(contact)
            navigation.navigate('Contacts', { screen: 'ViewContact' })
        },
        [navigation, setSelectedContact],
    )

    const onAssetPress = useCallback(
        async (asset: PeraAsset, scope: ChainScope) => {
            // Asset results span every account, but both detail screens read
            // the *selected* account for the owner row, balance, send sender
            // and opt-out — so hand the selection to the real holder first or
            // the asset gets attributed to the account searched from.
            const holderAddress = await resolveAssetHolderAddress(
                asset.assetId,
                scope,
            )
            const holder = holderAddress
                ? findAccountByAddressOn(accounts, scope.chainId, holderAddress)
                : undefined
            if (holder) {
                setSelectedAccountId(holder.id)
            }

            const hasNfts = checkCapability({
                chain: { chainId: scope.chainId, capability: 'nft' },
            })
            navigation.navigate('TabBar', {
                screen: 'Home',
                params:
                    hasNfts && isCollectible(asset)
                        ? {
                              screen: 'CollectibleDetails',
                              params: {
                                  assetId: asset.assetId,
                                  chainId: scope.chainId,
                              },
                          }
                        : {
                              screen: 'AssetDetails',
                              params: {
                                  assetId: asset.assetId,
                                  chainId: scope.chainId,
                              },
                          },
            })
        },
        [
            accounts,
            navigation,
            resolveAssetHolderAddress,
            setSelectedAccountId,
            checkCapability,
        ],
    )

    return {
        value,
        setValue,
        query,
        rows,
        hasResults,
        isLoading,
        scopes,
        toggleScope,
        selectedChainId,
        setSelectedChainId,
        chainFilterOptions,
        shouldShowAssetNetwork,
        openFilterSheet,
        onAccountPress,
        onContactPress,
        onAssetPress,
        onExpandSection,
    }
}

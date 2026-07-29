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
import {
    type WalletAccount,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { isCollectible, type PeraAsset } from '@perawallet/wallet-core-assets'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import {
    SEARCH_SCOPES,
    useGlobalSearch,
    type SearchScope,
} from '@perawallet/wallet-core-search'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SearchFilterContent } from '../../components/SearchFilterContent'

const DEFAULT_SECTION_LIMIT = 5

export type SearchRow =
    | { type: 'section_header'; kind: SearchScope; key: string }
    | { type: 'account'; account: WalletAccount; key: string }
    | { type: 'contact'; contact: Contact; key: string }
    | { type: 'asset'; asset: PeraAsset; key: string }
    | {
          type: 'show_more'
          kind: SearchScope
          hiddenCount: number
          key: string
      }

export type UseSearchScreenResult = {
    value: string
    setValue: (text: string) => void
    rows: SearchRow[]
    hasResults: boolean
    isLoading: boolean
    scopes: SearchScope[]
    toggleScope: (scope: SearchScope) => void
    openFilterSheet: () => void
    onAccountPress: (account: WalletAccount) => void
    onContactPress: (contact: Contact) => void
    onAssetPress: (asset: PeraAsset) => void
    onExpandSection: (kind: SearchScope) => void
}

type SectionConfig = {
    kind: SearchScope
    items: Array<WalletAccount | Contact | PeraAsset>
    toRow: (item: never) => SearchRow
}

export const useSearchScreen = (): UseSearchScreenResult => {
    const [scopes, setScopes] = useState<SearchScope[]>([...SEARCH_SCOPES])
    const toggleScope = useCallback((scope: SearchScope) => {
        setScopes(prev =>
            prev.includes(scope)
                ? prev.filter(s => s !== scope)
                : [...prev, scope],
        )
    }, [])
    const { value, setValue, results, hasResults, isLoading } = useGlobalSearch(
        {
            scopes,
        },
    )
    const navigation = useAppNavigation()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { setSelectedContact } = useContacts()
    const { request: requestBottomSheet } = useBottomSheet()

    const openFilterSheet = useCallback(() => {
        void requestBottomSheet({
            contents: (
                <SearchFilterContent
                    scopes={scopes}
                    onToggleScope={toggleScope}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, scopes, toggleScope])

    const [expandedSections, setExpandedSections] = useState<
        Record<SearchScope, boolean>
    >({ accounts: false, contacts: false, assets: false })

    const onExpandSection = useCallback((kind: SearchScope) => {
        setExpandedSections(prev => ({ ...prev, [kind]: true }))
    }, [])

    const rows = useMemo<SearchRow[]>(() => {
        const sections: SectionConfig[] = [
            {
                kind: 'accounts',
                items: results.accounts,
                toRow: (account: WalletAccount) => ({
                    type: 'account',
                    account,
                    key: `account-${account.address}`,
                }),
            },
            {
                kind: 'contacts',
                items: results.contacts,
                toRow: (contact: Contact) => ({
                    type: 'contact',
                    contact,
                    key: `contact-${contact.address}`,
                }),
            },
            {
                kind: 'assets',
                items: results.assets,
                toRow: (asset: PeraAsset) => ({
                    type: 'asset',
                    asset,
                    key: `asset-${asset.assetId}`,
                }),
            },
        ]

        const out: SearchRow[] = []
        for (const section of sections) {
            if (section.items.length === 0) continue

            out.push({
                type: 'section_header',
                kind: section.kind,
                key: `header-${section.kind}`,
            })

            const isExpanded = expandedSections[section.kind]
            const visible = isExpanded
                ? section.items
                : section.items.slice(0, DEFAULT_SECTION_LIMIT)

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
        }

        return out
    }, [results, expandedSections])

    const onAccountPress = useCallback(
        (account: WalletAccount) => {
            setSelectedAccountAddress(account.address)
            navigation.navigate('TabBar', {
                screen: 'Home',
                params: { screen: 'AccountDetails' },
            })
        },
        [navigation, setSelectedAccountAddress],
    )

    const onContactPress = useCallback(
        (contact: Contact) => {
            setSelectedContact(contact)
            navigation.navigate('Contacts', { screen: 'ViewContact' })
        },
        [navigation, setSelectedContact],
    )

    const onAssetPress = useCallback(
        (asset: PeraAsset) => {
            navigation.navigate('TabBar', {
                screen: 'Home',
                params: {
                    screen: isCollectible(asset)
                        ? 'CollectibleDetails'
                        : 'AssetDetails',
                    params: { assetId: asset.assetId },
                },
            })
        },
        [navigation],
    )

    return {
        value,
        setValue,
        rows,
        hasResults,
        isLoading,
        scopes,
        toggleScope,
        openFilterSheet,
        onAccountPress,
        onContactPress,
        onAssetPress,
        onExpandSection,
    }
}

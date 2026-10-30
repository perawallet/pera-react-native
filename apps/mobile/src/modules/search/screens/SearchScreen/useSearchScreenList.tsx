/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import {
    useCallback,
    useEffect,
    useRef,
    type ReactElement,
    type RefObject,
} from 'react'
import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    primaryContactAddress,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    PWIcon,
    PWTouchableOpacity,
    PWText,
    PWView,
    type PWFlatListRef,
} from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetTitle } from '@modules/assets'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import type { SearchScope } from '@perawallet/wallet-core-search'
import type { SearchRow } from './useSearchScreen'

export type UseSearchScreenListProps = {
    onAccountPress: (account: WalletAccount) => void
    onContactPress: (contact: Contact) => void
    onAssetPress: (asset: PeraAsset) => Promise<void>
    onExpandSection: (kind: SearchScope) => void
    chainId: ChainId
    /** The query and the scopes it spans; either change scrolls the list back to the top. */
    value: string
    scopes: SearchScope[]
}

export type UseSearchScreenListResult = {
    listRef: RefObject<Nullable<PWFlatListRef>>
    renderItem: (params: { item: SearchRow }) => ReactElement
    keyExtractor: (row: SearchRow) => string
}

export const useSearchScreenList = ({
    onAccountPress,
    onContactPress,
    onAssetPress,
    onExpandSection,
    chainId,
    value,
    scopes,
}: UseSearchScreenListProps): UseSearchScreenListResult => {
    const styles = useStyles()
    const { t } = useLanguage()
    const listRef = useRef<PWFlatListRef>(null)

    useEffect(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false })
    }, [value, scopes])

    const renderItem = useCallback(
        ({ item }: { item: SearchRow }) => {
            switch (item.type) {
                case 'section_header': {
                    return (
                        <PWView style={styles.sectionHeader}>
                            <PWText variant='h4'>
                                {t(`search.sections.${item.kind}`)}
                            </PWText>
                        </PWView>
                    )
                }
                case 'account': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onAccountPress(item.account)}
                            testID={`search_result_account_${chainAccountOf(item.account, LEGACY_CHAIN_ID)?.address}`}
                        >
                            <AccountDisplay
                                account={item.account}
                                showChevron={false}
                                style={styles.rowContainer}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'contact': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onContactPress(item.contact)}
                            testID={`search_result_contact_${primaryContactAddress(item.contact)}`}
                        >
                            <AddressDisplay
                                address={primaryContactAddress(item.contact)}
                                showCopy={false}
                                style={styles.rowContainer}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'asset': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => void onAssetPress(item.asset)}
                            style={styles.assetRow}
                            testID={`search_result_asset_${item.asset.assetId}`}
                        >
                            <AssetTitle
                                asset={item.asset}
                                chainId={chainId}
                                showId
                                nameVariant='body'
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'show_more': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onExpandSection(item.kind)}
                            style={styles.showMore}
                            testID={`search_show_more_${item.kind}`}
                        >
                            <PWText
                                variant='caption'
                                style={styles.showMoreText}
                            >
                                {t('search.show_more', {
                                    count: item.hiddenCount,
                                })}
                            </PWText>
                            <PWIcon
                                name='chevron-right'
                                variant='link'
                                size='sm'
                            />
                        </PWTouchableOpacity>
                    )
                }
            }
        },
        [
            onAccountPress,
            onContactPress,
            onAssetPress,
            onExpandSection,
            chainId,
            styles,
            t,
        ],
    )

    const keyExtractor = useCallback((row: SearchRow) => row.key, [])

    return {listRef, renderItem, keyExtractor}
}

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

import { useCallback } from 'react'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { FilterSelection } from '@components/FilterSelection'
import { AssetSelectionList } from '@modules/assets'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { OnrampAssetItemView } from './OnrampAssetItemView'
import {
    useOnrampPairSelectionContent,
    type OnrampSelectableToken,
} from './useOnrampPairSelectionContent'
import { useStyles } from './styles'

export type OnrampPairSelectionContentProps = {
    variant?: 'source' | 'destination'
    /** The chain and network the listed tokens are bought onto. */
    scope: ChainScope
}

export const OnrampPairSelectionContent = ({
    variant = 'destination',
    scope,
}: OnrampPairSelectionContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        items,
        searchFilter,
        setSearchFilter,
        isLoading,
        listScope,
        chainOptions,
        selectedChainId,
        handleSelectChain,
        handleTokenSelected,
    } = useOnrampPairSelectionContent({ variant, scope })

    const renderItem = useCallback(
        ({ item }: { item: OnrampSelectableToken }) => (
            <OnrampAssetItemView
                token={item.token}
                asset={item.asset}
                scope={listScope}
                balance={item.balance}
                onPress={() => handleTokenSelected(item.token)}
                style={styles.item}
                testID={`onramp-asset-row-${item.token.id}`}
            />
        ),
        [handleTokenSelected, styles, listScope],
    )

    const title =
        variant === 'destination'
            ? t('onramp.pair_selection.title_to')
            : t('onramp.pair_selection.title_from')

    return (
        <>
            <SheetHeader title={title} />
            <PWView style={styles.body}>
                <AssetSelectionList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={item => item.token.id}
                    searchValue={searchFilter}
                    onSearchChange={setSearchFilter}
                    searchPlaceholder={t('onramp.pair_selection.search')}
                    searchAccessory={
                        chainOptions.length > 0 ? (
                            <FilterSelection<Nullable<ChainId>>
                                options={chainOptions}
                                selectedValue={selectedChainId}
                                onSelect={handleSelectChain}
                                testID='onramp_destination_chain_filter'
                            />
                        ) : undefined
                    }
                    isLoading={isLoading && items.length === 0}
                    cardLayout
                    ListEmptyComponent={
                        <PWView style={styles.centered}>
                            <PWText
                                variant='body'
                                style={styles.emptyText}
                            >
                                {t('onramp.pair_selection.empty')}
                            </PWText>
                        </PWView>
                    }
                />
            </PWView>
        </>
    )
}

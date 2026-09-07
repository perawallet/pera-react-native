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
import { ActivityIndicator } from 'react-native'
import {
    PWIcon,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { SearchInput } from '@components/SearchInput'
import { FilterSelection } from '@components/FilterSelection'
import { OnrampSourceRow } from './OnrampSourceRow'
import {
    useOnrampSourceSelection,
    type OnrampSourceFilter,
} from './useOnrampSourceSelection'
import { useStyles } from './styles'

const FILTERS: { value: OnrampSourceFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'onramp.source_selection.filter_all' },
    { value: 'fiat', labelKey: 'onramp.source_selection.filter_fiat' },
    { value: 'crypto', labelKey: 'onramp.source_selection.filter_crypto' },
]

export const OnrampSourceSelectionContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    // Resolves the selected SOURCE token id; the form handler maps it to a pair
    // while preserving the current destination.
    const { resolve } = useBottomSheetResult<string>()
    const {
        isLoading,
        filter,
        setFilter,
        search,
        setSearch,
        expandFiat,
        canExpandFiat,
        fiatTokens,
        cryptoTokens,
        isFiat,
        duplicatedSymbols,
    } = useOnrampSourceSelection()

    const handleSelect = useCallback(
        (token: RampToken) => {
            resolve(token.id)
        },
        [resolve],
    )

    const showFiat = filter === 'all' || filter === 'fiat'
    const showCrypto = filter === 'all' || filter === 'crypto'
    const isEmpty = fiatTokens.length === 0 && cryptoTokens.length === 0

    const renderRows = (tokens: RampToken[]) =>
        tokens.map(token => (
            <OnrampSourceRow
                key={token.id}
                token={token}
                isFiat={isFiat(token)}
                showNetworkBadge={duplicatedSymbols.has(
                    token.symbol.toLowerCase(),
                )}
                onPress={() => handleSelect(token)}
            />
        ))

    return (
        <>
            <SheetHeader title={t('onramp.source_selection.title')} />
            <PWView style={styles.body}>
                {isLoading ? (
                    <PWView style={styles.centered}>
                        <ActivityIndicator />
                    </PWView>
                ) : (
                    <PWScrollView
                        contentContainerStyle={styles.searchContainer}
                    >
                        <SearchInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t(
                                'onramp.source_selection.search_placeholder',
                            )}
                            testID='onramp-source-search'
                        />

                        <FilterSelection<OnrampSourceFilter>
                            options={FILTERS.map(({ value, labelKey }) => ({
                                value,
                                label: t(labelKey),
                                testID: `onramp-source-filter-${value}`,
                            }))}
                            selectedValue={filter}
                            onSelect={setFilter}
                            contentContainerStyle={styles.filterRow}
                        />

                        {isEmpty ? (
                            <PWView style={styles.centered}>
                                <PWText
                                    variant='body'
                                    style={styles.emptyText}
                                >
                                    {t('onramp.source_selection.empty')}
                                </PWText>
                            </PWView>
                        ) : (
                            <>
                                {showFiat && fiatTokens.length > 0 && (
                                    <>
                                        <PWText
                                            variant='captionMedium'
                                            style={styles.sectionHeader}
                                        >
                                            {t(
                                                'onramp.source_selection.fiat_section',
                                            )}
                                        </PWText>
                                        {renderRows(fiatTokens)}
                                        {canExpandFiat && (
                                            <PWTouchableOpacity
                                                onPress={expandFiat}
                                                style={styles.seeAllRow}
                                                testID='onramp-source-see-all-fiat'
                                            >
                                                <PWIcon
                                                    name='chevron-down'
                                                    size='sm'
                                                />
                                                <PWText
                                                    variant='footnoteMedium'
                                                    style={styles.seeAllText}
                                                >
                                                    {t(
                                                        'onramp.source_selection.see_all_fiat',
                                                    )}
                                                </PWText>
                                            </PWTouchableOpacity>
                                        )}
                                    </>
                                )}

                                {showCrypto && cryptoTokens.length > 0 && (
                                    <>
                                        <PWText
                                            variant='captionMedium'
                                            style={styles.sectionHeader}
                                        >
                                            {t(
                                                'onramp.source_selection.crypto_section',
                                            )}
                                        </PWText>
                                        {renderRows(cryptoTokens)}
                                    </>
                                )}
                            </>
                        )}
                    </PWScrollView>
                )}
            </PWView>
        </>
    )
}

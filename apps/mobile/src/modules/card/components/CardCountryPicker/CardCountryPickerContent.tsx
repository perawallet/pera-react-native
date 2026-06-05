/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import type { SupportedCountry } from '@perawallet/wallet-core-card'
import {
    PWButton,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { isoToFlagEmoji } from '../../utils/isoToFlagEmoji'
import { useCardCountryPicker } from './useCardCountryPicker'
import { useStyles } from './styles'

export const CardCountryPickerContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        search,
        setSearch,
        countries,
        isLoading,
        isError,
        refetch,
        handleSelect,
    } = useCardCountryPicker()

    const renderItem = useCallback(
        ({ item }: { item: SupportedCountry }) => (
            <PWTouchableOpacity
                style={styles.row}
                onPress={() => handleSelect(item)}
                testID={`card-country-${item.iso3166alpha2}`}
            >
                <PWText variant='body'>
                    {`${isoToFlagEmoji(item.iso3166alpha2)}  ${item.name}`}
                </PWText>
            </PWTouchableOpacity>
        ),
        [handleSelect, styles.row],
    )

    const keyExtractor = useCallback((item: SupportedCountry) => item.id, [])

    return (
        <PWView style={styles.container}>
            <SheetHeader
                title={t('peraCard.create_account.country_picker_title')}
            />

            {isError ? (
                <EmptyView
                    style={styles.center}
                    title={t('peraCard.create_account.country_error_title')}
                    body={t('peraCard.create_account.country_error_body')}
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('peraCard.create_account.country_retry')}
                            onPress={refetch}
                        />
                    }
                />
            ) : isLoading ? (
                <PWView style={styles.center}>
                    <ActivityIndicator />
                </PWView>
            ) : (
                <PWView style={styles.content}>
                    <SearchInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t(
                            'peraCard.create_account.country_search_placeholder',
                        )}
                    />
                    <PWFlatList
                        inBottomSheet
                        data={countries}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        style={styles.list}
                        keyboardShouldPersistTaps='handled'
                        ListEmptyComponent={
                            <EmptyView
                                title={t(
                                    'peraCard.create_account.country_empty_title',
                                )}
                                body={t(
                                    'peraCard.create_account.country_empty_body',
                                )}
                            />
                        }
                    />
                </PWView>
            )}
        </PWView>
    )
}

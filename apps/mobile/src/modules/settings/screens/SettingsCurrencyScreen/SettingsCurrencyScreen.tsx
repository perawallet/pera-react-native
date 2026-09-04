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
import { Trans } from 'react-i18next'
import type { Currency } from '@perawallet/wallet-core-currencies'

import {
    PWScreen,
    PWRadioButton,
    PWFlatList,
    PWView,
    PWText,
} from '@components/core'
import { ListItemDivider } from '@components/ListItemDivider'
import { InfoCallout } from '@components/InfoCallout'
import { SearchInput } from '@components/SearchInput'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsCurrencyScreen } from './useSettingsCurrencyScreen'
import { useStyles } from './styles'

export const SettingsCurrencyScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        preferredCurrency,
        fallbackCurrency,
        setCurrency,
        search,
        setSearch,
        filteredData,
        isRateUnavailableOffline,
    } = useSettingsCurrencyScreen()

    const keyExtractor = (item: Currency) => item.id

    const renderItem = useCallback(
        ({ item }: { item: Currency }) => {
            return (
                <PWRadioButton
                    onPress={() => setCurrency(item)}
                    isSelected={preferredCurrency === item.id}
                    testID={`settings_currency_item_${item.id.toLowerCase()}`}
                >
                    <PWText variant='bodyLarge'>
                        <PWText
                            variant='bodyLarge'
                            weight={700}
                        >
                            {item.id}
                        </PWText>
                        {` (${item.name})`}
                    </PWText>
                </PWRadioButton>
            )
        },
        [preferredCurrency, setCurrency],
    )

    return (
        <PWScreen
            scroll='never'
            testID='settings_currency_screen'
        >
            <PWView style={styles.container}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                >
                    {t('settings.currency.title')}
                </PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.description}
                >
                    <Trans
                        i18nKey='settings.currency.description'
                        values={{ preferredCurrency, fallbackCurrency }}
                        components={[
                            <PWText
                                key='emphasis'
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.descriptionEmphasis}
                            />,
                        ]}
                    />
                </PWText>
                {isRateUnavailableOffline ? (
                    <InfoCallout
                        title={t('settings.currency.offline_rate.title')}
                        body={t('settings.currency.offline_rate.body', {
                            currency: preferredCurrency,
                        })}
                        testID='settings_currency_offline_notice'
                    />
                ) : null}
                <SearchInput
                    placeholder={t('settings.currency.search_placeholder')}
                    value={search}
                    onChangeText={setSearch}
                    testID='settings_currency_search_input'
                />
                <PWFlatList
                    data={filteredData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    extraData={preferredCurrency}
                    ItemSeparatorComponent={ListItemDivider}
                    testID='settings_currency_list'
                />
            </PWView>
        </PWScreen>
    )
}

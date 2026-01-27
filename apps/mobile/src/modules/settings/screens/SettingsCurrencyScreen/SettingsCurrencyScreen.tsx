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

import { Text } from '@rneui/themed'

import { useStyles } from './styles'
import { PWView, PWRadioButton, PWFlatList } from '@components/core'
import { Currency } from '@perawallet/wallet-core-currencies'
import { SearchInput } from '@components/SearchInput'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsCurrencyScreen } from './useSettingsCurrencyScreen'

export const SettingsCurrencyScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        primaryCurrency,
        secondaryCurrency,
        setCurrency,
        search,
        setSearch,
        filteredData,
    } = useSettingsCurrencyScreen()

    const renderItem = ({ item }: { item: Currency }) => {
        return (
            <PWRadioButton
                title={`${item.name} (${item.id})`}
                onPress={() => setCurrency(item)}
                isSelected={primaryCurrency === item.id}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <Text h3>{t('settings.currency.title')}</Text>
            <Text>
                {t('settings.currency.description', {
                    primaryCurrency,
                    secondaryCurrency,
                })}
            </Text>
            <SearchInput
                placeholder={t('settings.currency.search_placeholder')}
                value={search}
                onChangeText={setSearch}
            />
            <PWFlatList
                data={filteredData}
                renderItem={renderItem}
            />
        </PWView>
    )
}

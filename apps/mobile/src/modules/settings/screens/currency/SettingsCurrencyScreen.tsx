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
import PWView from '../../../../components/common/view/PWView'
import {
    Currency,
    useCurrenciesQuery,
    useCurrency,
} from '@perawallet/wallet-core-currencies'
import { useEffect, useState } from 'react'
import { FlatList } from 'react-native'

import RadioButton from '../../../../components/common/radio-button/RadioButton'
import SearchInput from '../../../../components/common/search-input/SearchInput'
import { useInvalidateAssetPrices } from '@perawallet/wallet-core-assets'
import { useLanguage } from '../../../../hooks/useLanguage'

const SettingsCurrencyScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { preferredCurrency, setPreferredCurrency } = useCurrency()
    const [search, setSearch] = useState<string>()
    const [filteredData, setFilteredData] = useState<Currency[]>([])

    const { data } = useCurrenciesQuery()
    const { invalidateAssetPrices } = useInvalidateAssetPrices()

    useEffect(() => {
        if (!search?.length) {
            setFilteredData(data ?? [])
        } else {
            const lowercaseSearch = search.toLowerCase()
            setFilteredData(
                (data ?? []).filter(
                    d =>
                        d.name.toLowerCase().includes(lowercaseSearch) ||
                        d.id.toLowerCase().includes(lowercaseSearch),
                ),
            )
        }
    }, [data, search])

    const setCurrency = (currency: Currency) => {
        setPreferredCurrency(currency.id)
        invalidateAssetPrices()
    }

    const renderItem = ({ item }: { item: Currency }) => {
        return (
            <RadioButton
                title={`${item.name} (${item.id})`}
                onPress={() => setCurrency(item)}
                selected={preferredCurrency === item.id}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <Text h3>{t('settings.currency.title')}</Text>
            <Text>
                {t('settings.currency.description')}
            </Text>
            <SearchInput
                placeholder={t('settings.currency.search_placeholder')}
                value={search}
                onChangeText={setSearch}
            />
            <FlatList
                data={filteredData}
                renderItem={renderItem}
            />
        </PWView>
    )
}

export default SettingsCurrencyScreen

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

import { useCallback, useMemo } from 'react'
import {
    PWFlatList,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useSigningContext } from '@modules/transactions/components/signing/SigningContext'
import type { SigningStackParamList } from '@modules/transactions/routes/signing/types'
import { GroupPreview } from './GroupPreview'
import { MultiGroupListHeader } from './MultiGroupListHeader'
import { MultiGroupListFooter } from './MultiGroupListFooter'
import { useStyles } from './styles'

type NavigationProp = NativeStackNavigationProp<
    SigningStackParamList,
    'MultiGroupList'
>

type GroupItem = {
    transactions: PeraDisplayableTransaction[]
    index: number
}

export const MultiGroupListScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { groups, totalFee } = useSigningContext()

    const groupItems: GroupItem[] = useMemo(
        () => groups.map((transactions, index) => ({ transactions, index })),
        [groups],
    )

    const handleGroupPress = (groupIndex: number) => {
        navigation.navigate('GroupList', { groupIndex })
    }

    const renderItem = useCallback(
        ({ item }: { item: GroupItem }) => (
            <GroupPreview
                transactions={item.transactions}
                groupIndex={item.index}
                onPress={() => handleGroupPress(item.index)}
            />
        ),
        [handleGroupPress],
    )

    const keyExtractor = useCallback(
        (item: GroupItem) => `group-${item.index}`,
        [],
    )

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    const ListHeader = useMemo(
        () => <MultiGroupListHeader groupCount={groups.length} />,
        [groups.length],
    )

    const ListFooter = useMemo(
        () => <MultiGroupListFooter totalFee={totalFee} />,
        [totalFee],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                center={
                    <PWText variant='h4'>
                        {t('signing.transactions.title')}
                    </PWText>
                }
            />
            <PWFlatList
                data={groupItems}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ItemSeparator}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                contentContainerStyle={styles.contentContainer}
            />
        </PWView>
    )
}

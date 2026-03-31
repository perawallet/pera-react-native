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
import {
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountWithBalance } from '@modules/accounts/components/AccountWithBalance'
import { useBidali } from '../../hooks/useBidali'
import type { BidaliStackParamList } from '../../routes/types'
import { useStyles } from './styles'

export const BidaliAccountSelectionScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const { setSelectedAccount } = useBidali()
    const navigation =
        useNavigation<StackNavigationProp<BidaliStackParamList>>()

    const handleSelected = useCallback(
        (account: WalletAccount) => {
            setSelectedAccount(account)
            navigation.navigate('BidaliWebView')
        },
        [setSelectedAccount, navigation],
    )

    const renderItem = useCallback(
        ({ item }: { item: WalletAccount }) => (
            <PWTouchableOpacity onPress={() => handleSelected(item)}>
                <AccountWithBalance account={item} />
            </PWTouchableOpacity>
        ),
        [handleSelected],
    )

    const keyExtractor = useCallback((item: WalletAccount) => item.address, [])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWText variant='h1'>
                    {t('giftCard.accountSelection.title')}
                </PWText>
                <PWText style={styles.subtitle}>
                    {t('giftCard.accountSelection.subtitle')}
                </PWText>
            </PWView>

            <PWFlatList
                contentContainerStyle={styles.list}
                data={accounts}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
            />
        </PWView>
    )
}

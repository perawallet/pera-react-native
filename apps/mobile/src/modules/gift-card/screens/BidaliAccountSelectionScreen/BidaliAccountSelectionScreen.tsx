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
import { useNavigation } from '@react-navigation/native'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWFlatList, PWScreen } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { SelectableAccountRow } from '@modules/accounts/components/SelectableAccountRow'
import { useBidali } from '../../hooks/useBidali'
import { useStyles } from './styles'

import type { StackNavigationProp } from '@react-navigation/stack'
import type { BidaliStackParamList } from '../../routes/types'

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
            <SelectableAccountRow
                account={item}
                onSelect={handleSelected}
            />
        ),
        [handleSelected],
    )

    const keyExtractor = useCallback((item: WalletAccount) => item.address, [])

    return (
        <PWScreen
            scroll={false}
            horizontalPadding='none'
            keyboard='none'
        >
            <ScreenHeader
                style={styles.header}
                title={t('giftCard.accountSelection.title')}
                description={t('giftCard.accountSelection.subtitle')}
            />

            <PWFlatList
                contentContainerStyle={styles.list}
                data={accounts}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
            />
        </PWScreen>
    )
}

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

import PWTouchableOpacity from '../../../../components/common/touchable-opacity/PWTouchableOpacity'
import AccountAssetItemView from '../../../../components/assets/asset-item/AccountAssetItemView'
import PWView from '../../../../components/common/view/PWView'
import { PropsWithChildren, useMemo } from 'react'
import { useStyles } from './styles'
import { Text } from '@rneui/themed'

import SearchInput from '../../../../components/common/search-input/SearchInput'
import PWButton from '../../../../components/common/button/PWButton'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountBalancesQuery,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { FlashList } from '@shopify/flash-list'
import EmptyView from '../../../../components/common/empty-view/EmptyView'
import LoadingView from '../../../../components/common/loading/LoadingView'

type AccountAssetListProps = {
    account: WalletAccount
    scrollEnabled?: boolean
} & PropsWithChildren

//TODO implement links and buttons
const AccountAssetList = ({
    account,
    children,
    scrollEnabled,
}: AccountAssetListProps) => {
    const styles = useStyles()
    const { accountBalances, isPending } = useAccountBalancesQuery([account])
    const balanceData = useMemo(
        () => accountBalances.get(account.address),
        [accountBalances, account.address],
    )
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const goToAssetScreen = (asset: AssetWithAccountBalance) => {
        navigation.navigate('AssetDetails', {
            assetId: asset.assetId,
        })
    }

    const renderItem = ({ item }: { item: AssetWithAccountBalance }) => {
        return (
            <PWTouchableOpacity
                style={styles.itemContainer}
                onPress={() => goToAssetScreen(item)}
                key={`asset-key-${item.assetId}`}
            >
                <AccountAssetItemView accountBalance={item} />
            </PWTouchableOpacity>
        )
    }

    return (
        <FlashList
            data={balanceData?.assetBalances}
            renderItem={renderItem}
            scrollEnabled={scrollEnabled}
            keyExtractor={item => item.assetId}
            contentContainerStyle={styles.rootContainer}
            ListHeaderComponent={
                <PWView style={styles.headerContainer}>
                    {children}
                    <PWView style={styles.titleBar}>
                        <Text
                            style={styles.title}
                            h4
                        >
                            Assets
                        </Text>
                        <PWView style={styles.titleBarButtonContainer}>
                            <PWButton
                                icon='sliders'
                                variant='helper'
                                paddingStyle='dense'
                            />
                            <PWButton
                                icon='plus'
                                title='Add Asset'
                                variant='helper'
                                paddingStyle='dense'
                            />
                        </PWView>
                    </PWView>
                    <SearchInput placeholder='Search assets' />
                </PWView>
            }
            ListEmptyComponent={
                <EmptyView
                    title='No Assets'
                    body='You have no assets linked to this account'
                />
            }
            ListFooterComponent={
                isPending ? (
                    <PWView style={styles.footer}>
                        <LoadingView
                            variant='skeleton'
                            size='sm'
                            count={3}
                        />
                    </PWView>
                ) : (
                    <PWView style={styles.footer} />
                )
            }
        />
    )
}

export default AccountAssetList

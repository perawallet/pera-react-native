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
import { useMemo } from 'react'
import { useStyles } from './styles'
import { Skeleton, Text } from '@rneui/themed'

import SearchInput from '../../../../components/common/search-input/SearchInput'
import PWButton from '../../../../components/common/button/PWButton'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountBalancesQuery,
    WalletAccount,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { debugLog } from '@perawallet/wallet-core-shared'

type AccountAssetListProps = {
    account: WalletAccount
}

const LoadingView = () => {
    const styles = useStyles()
    return (
        <PWView style={styles.loadingContainer}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
        </PWView>
    )
}

//TODO implement links and buttons
//TODO Convert to flatlist/flashlist which wraps teh other content as a header
const AccountAssetList = ({ account }: AccountAssetListProps) => {
    const styles = useStyles()
    const { accountBalances, isPending } = useAccountBalancesQuery([account])
    const balanceData = useMemo(
        () => accountBalances.get(account.address),
        [accountBalances, account.address],
    )
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const goToAssetScreen = (asset: AssetWithAccountBalance) => {
        navigation.navigate('AssetDetails', {
            asset,
            account,
        })
    }

    const renderItem = (item: AssetWithAccountBalance) => {
        return (
            <PWTouchableOpacity
                onPress={() => goToAssetScreen(item)}
                key={`asset-key-${item.assetId}`}
            >
                <AccountAssetItemView accountBalance={item} />
            </PWTouchableOpacity>
        )
    }

    return (
        <PWView style={styles.container}>
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
            {isPending && <LoadingView />}
            {!isPending && (
                <>
                    <SearchInput placeholder='Search assets' />
                    <PWView style={styles.listContainer}>
                        {balanceData?.assetBalances?.map(item =>
                            renderItem(item),
                        )}
                    </PWView>
                </>
            )}
        </PWView>
    )
}

export default AccountAssetList

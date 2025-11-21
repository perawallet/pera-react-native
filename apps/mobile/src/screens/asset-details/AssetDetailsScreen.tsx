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

import { Tab, TabView } from '@rneui/themed'
import MainScreenLayout from '../../layouts/MainScreenLayout'
import { StaticScreenProps, useNavigation } from '@react-navigation/native'
import {
    getAccountDisplayName,
    PeraAsset,
    WalletAccount,
} from '@perawallet/core'
import { useLayoutEffect, useState } from 'react'
import { useStyles } from './styles'
import AssetMarkets from '../../components/asset-details/market/AssetMarkets'
import AssetHoldings from '../../components/asset-details/holdings/AssetHoldings'
import AccountIcon from '../../components/accounts/account-icon/AccountIcon'
import useToast from '../../hooks/toast'

type AssetDetailsScreenProps = {
    account: WalletAccount
    asset: PeraAsset
}

//TODO implement me
const AssetDetailsScreen = ({
    route,
}: StaticScreenProps<AssetDetailsScreenProps>) => {
    const asset = route.params?.asset
    const account = route.params?.account
    const { showToast } = useToast()

    const styles = useStyles()
    const [tabIndex, setTabIndex] = useState(0)

    const navigation = useNavigation()

    const notImplemented = () => {
        showToast({
            title: 'Not implemented',
            body: 'This feature is not implemented yet',
            type: 'error',
        })
    }

    useLayoutEffect(() => {
        navigation.setOptions({
            title: getAccountDisplayName(account),
            headerRight: () => (
                <AccountIcon
                    account={account}
                    onPress={notImplemented}
                />
            ),
        })
    }, [navigation, account])
    return (
        <MainScreenLayout
            fullScreen
            header
        >
            <Tab
                value={tabIndex}
                onChange={e => setTabIndex(e)}
                containerStyle={styles.tabs}
                indicatorStyle={styles.indicator}
                titleStyle={styles.tabItem}
                dense
            >
                <Tab.Item title='Holdings' />
                <Tab.Item title='Markets' />
            </Tab>
            <TabView
                value={tabIndex}
                onChange={setTabIndex}
                animationType='spring'
                animationConfig={{
                    duration: 150,
                    bounciness: 1,
                    useNativeDriver: true,
                }}
            >
                <TabView.Item style={styles.fullWidth}>
                    <AssetHoldings
                        account={account}
                        asset={asset}
                    />
                </TabView.Item>
                <TabView.Item style={styles.fullWidth}>
                    <AssetMarkets asset={asset} />
                </TabView.Item>
            </TabView>
        </MainScreenLayout>
    )
}

export default AssetDetailsScreen

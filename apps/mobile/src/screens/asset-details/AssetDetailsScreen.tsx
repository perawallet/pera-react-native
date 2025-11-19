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
import { StaticScreenProps } from '@react-navigation/native'
import { PeraAsset, WalletAccount } from '@perawallet/core'
import { useState } from 'react'
import { useStyles } from './styles'
import AssetMarkets from '../../components/asset-details/market/AssetMarkets'
import AssetHoldings from '../../components/asset-details/holdings/AssetHoldings'

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

    const styles = useStyles()
    const [tabIndex, setTabIndex] = useState(0)

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
                <Tab.Item title='Market' />
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
                    <AssetMarkets
                        account={account}
                        asset={asset}
                    />
                </TabView.Item>
            </TabView>
        </MainScreenLayout>
    )
}

export default AssetDetailsScreen

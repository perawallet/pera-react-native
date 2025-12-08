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
import { StaticScreenProps, useNavigation } from '@react-navigation/native'
import {
    getAccountDisplayName,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useStyles } from './styles'
import AssetMarkets from '../components/market/AssetMarkets'
import AssetHoldings from '../components/holdings/AssetHoldings'
import AccountIcon from '../../../components/accounts/account-icon/AccountIcon'
import useToast from '../../../hooks/toast'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import LoadingView from '../../../components/common/loading/LoadingView'
import { TAB_ANIMATION_CONFIG } from '../../../constants/ui'
import PWView from '../../../components/common/view/PWView'
import { useLanguage } from '../../../hooks/useLanguage'

type AssetDetailsScreenProps = {
    assetId: string
}

//TODO implement me
const AssetDetailsScreen = ({
    route,
}: StaticScreenProps<AssetDetailsScreenProps>) => {
    const assetId = route.params?.assetId
    const { showToast } = useToast()
    const { t } = useLanguage()

    const styles = useStyles()
    const [tabIndex, setTabIndex] = useState(0)

    const navigation = useNavigation()
    const account = useSelectedAccount()
    const { data: asset, isPending } = useSingleAssetDetailsQuery(assetId)

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }, [showToast, t])

    const headerIcon = useMemo(() => {
        if (!account) {
            return null
        }
        return (
            <AccountIcon
                account={account}
                onPress={notImplemented}
            />
        )
    }, [account, notImplemented])

    useLayoutEffect(() => {
        navigation.setOptions({
            title: getAccountDisplayName(account),
            headerRight: () => headerIcon,
        })
    }, [navigation, account, headerIcon])

    if (!asset || !account || isPending) {
        return (
            <LoadingView
                variant='skeleton'
                count={3}
                size='lg'
            />
        )
    }

    return (
        <PWView style={styles.contentContainer}>
            <Tab
                value={tabIndex}
                onChange={e => setTabIndex(e)}
                containerStyle={styles.tabs}
                indicatorStyle={styles.indicator}
                titleStyle={styles.tabItem}
                dense
            >
                <Tab.Item title={t('asset_details.main_screen.holdings_tab')} />
                <Tab.Item title={t('asset_details.main_screen.markets_tab')} />
            </Tab>
            <TabView
                value={tabIndex}
                onChange={setTabIndex}
                animationType='spring'
                animationConfig={TAB_ANIMATION_CONFIG}
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
        </PWView>
    )
}

export default AssetDetailsScreen

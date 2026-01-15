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

import { PWTab, PWTabView, PWView } from '@components/core'
import { useNavigation } from '@react-navigation/native'
import {
    getAccountDisplayName,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useStyles } from './styles'
import { AssetMarkets } from '@modules/assets/components/market/AssetMarkets'
import { AssetHoldings } from '@modules/assets/components/holdings/AssetHoldings'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useToast } from '@hooks/toast'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { LoadingView } from '@components/LoadingView'
import { TAB_ANIMATION_CONFIG } from '@constants/ui'
import { useLanguage } from '@hooks/language'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AccountStackParamsList } from '@modules/accounts/routes'

type AssetDetailsScreenProps = NativeStackScreenProps<
    AccountStackParamsList,
    'AssetDetails'
>
export const AssetDetailsScreen = ({ route }: AssetDetailsScreenProps) => {
    const assetId = route.params?.assetId
    const { showToast } = useToast()
    const { t } = useLanguage()

    const styles = useStyles()
    const [tabIndex, setTabIndex] = useState(0)

    const navigation = useNavigation()
    const account = useSelectedAccount()
    const { data: asset, isPending } = useSingleAssetDetailsQuery(assetId ?? '')

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
        //TODO implement press event
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
            <PWTab
                value={tabIndex}
                onChange={e => setTabIndex(e)}
                containerStyle={styles.tabs}
                indicatorStyle={styles.indicator}
                titleStyle={styles.tabItem}
                dense
            >
                <PWTab.Item
                    title={t('asset_details.main_screen.holdings_tab')}
                />
                <PWTab.Item
                    title={t('asset_details.main_screen.markets_tab')}
                />
            </PWTab>
            <PWTabView
                value={tabIndex}
                onChange={setTabIndex}
                animationType='spring'
                animationConfig={TAB_ANIMATION_CONFIG}
            >
                <PWTabView.Item style={styles.fullWidth}>
                    <AssetHoldings
                        account={account}
                        asset={asset}
                    />
                </PWTabView.Item>
                <PWTabView.Item style={styles.fullWidth}>
                    <AssetMarkets asset={asset} />
                </PWTabView.Item>
            </PWTabView>
        </PWView>
    )
}

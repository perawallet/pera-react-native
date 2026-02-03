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

import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { useNavigation } from '@react-navigation/native'
import {
    getAccountDisplayName,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCallback, useLayoutEffect, useMemo } from 'react'
import { useStyles } from './styles'
import { AssetMarkets } from '@modules/assets/components/market/AssetMarkets'
import { AssetHoldings } from '@modules/assets/components/holdings/AssetHoldings'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useToast } from '@hooks/useToast'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AccountStackParamsList } from '@modules/accounts/routes'
import { PWView } from '@components/core'

export type AssetDetailsScreenProps = NativeStackScreenProps<
    AccountStackParamsList,
    'AssetDetails'
>

export type AssetDetailsTabParamsList = {
    Holdings: undefined
    Markets: undefined
}

const Tab = createPWTabNavigator<AssetDetailsTabParamsList>()

export const AssetDetailsScreen = ({ route }: AssetDetailsScreenProps) => {
    const assetId = route.params?.assetId
    const { showToast } = useToast()
    const { t } = useLanguage()

    const styles = useStyles()

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
            <Tab.Navigator>
                <Tab.Screen
                    name='Holdings'
                    options={{ title: t('asset_details.main_screen.holdings_tab') }}
                >
                    {() => (
                        <AssetHoldings
                            account={account}
                            asset={asset}
                        />
                    )}
                </Tab.Screen>

                <Tab.Screen
                    name='Markets'
                    options={{ title: t('asset_details.main_screen.markets_tab') }}
                >
                    {() => <AssetMarkets asset={asset} />}
                </Tab.Screen>
            </Tab.Navigator>
        </PWView>
    )
}

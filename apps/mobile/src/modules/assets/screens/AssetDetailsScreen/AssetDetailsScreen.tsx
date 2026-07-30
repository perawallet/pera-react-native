/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import {
    getAccountDisplayName,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { dedupeSecondaryLabel } from '@perawallet/wallet-core-shared'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { useEffect, useState } from 'react'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'
import { useStyles } from './styles'
import { AssetMarkets } from '@modules/assets/components/market/AssetMarkets'
import { AssetHoldings } from '@modules/assets/components/holdings/AssetHoldings'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { type NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AccountStackParamsList } from '@modules/accounts/routes'
import { PWText, PWView } from '@components/core'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { AccountHeaderMenu } from '@components/AccountHeaderMenu'

export type AssetDetailsScreenProps = NativeStackScreenProps<
    AccountStackParamsList,
    'AssetDetails'
>

type AssetDetailsTabParamsList = {
    Holdings: undefined
    Markets: undefined
}

const Tab = createPWTabNavigator<AssetDetailsTabParamsList>()

export const AssetDetailsScreen = ({ route }: AssetDetailsScreenProps) => {
    const assetId = route.params?.assetId
    const isCollectible = route.params?.isCollectible ?? false
    const { t } = useLanguage()

    const styles = useStyles()

    const account = useSelectedAccount()
    const { data: asset, isPending } = useSingleAssetDetailsQuery(assetId ?? '')
    const { displayName: accountDisplayName } = useResolvedAddress(
        account?.address ?? '',
        { enabled: !!account?.address },
    )

    const [swipeEnabled, setSwipeEnabled] = useState(true)

    // Screen-view tracking (screen_asset_detail) is centralized in the
    // navigator's screenListeners (see routes/listeners.ts). This effect only
    // fires the asset-specific "Show" event, which carries the asset id.
    useEffect(() => {
        if (assetId && !isCollectible) {
            trackEvent(AssetDetailsEvent.Show, {
                [AnalyticsMetadataKey.AssetId]: assetId,
            })
        }
    }, [assetId, isCollectible])

    // Dedupe compares rendered strings, so both sides must share the same
    // ('short') truncation — a 'long'-format secondary would never match and
    // the address would render twice again.
    const headerPrimary = getAccountDisplayName(account)
    const headerSecondary = dedupeSecondaryLabel(
        headerPrimary,
        accountDisplayName,
    )

    useNavigationHeader({
        title: (
            <PWView style={styles.headerTitleContainer}>
                <PWText
                    variant='h4'
                    truncate
                >
                    {headerPrimary}
                </PWText>
                {!!headerSecondary && (
                    <PWText
                        variant='caption'
                        style={styles.headerSubtitle}
                        truncate
                        ellipsizeMode='middle'
                    >
                        {headerSecondary}
                    </PWText>
                )}
            </PWView>
        ),
        right: account ? (
            <AccountHeaderMenu testID='asset_details_screen_dropdown' />
        ) : null,
    })

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
        <PWView
            style={styles.contentContainer}
            testID='asset_details_screen'
        >
            <Tab.Navigator screenOptions={{ swipeEnabled }}>
                <Tab.Screen
                    name='Holdings'
                    options={{
                        title: t('asset_details.main_screen.holdings_tab'),
                    }}
                >
                    {() => (
                        <AssetHoldings
                            account={account}
                            asset={asset}
                            onSwipeEnabledChange={setSwipeEnabled}
                            isCollectible={isCollectible}
                        />
                    )}
                </Tab.Screen>

                <Tab.Screen
                    name='Markets'
                    options={{
                        title: t('asset_details.main_screen.markets_tab'),
                    }}
                >
                    {() => (
                        <AssetMarkets
                            asset={asset}
                            onSwipeEnabledChange={setSwipeEnabled}
                        />
                    )}
                </Tab.Screen>
            </Tab.Navigator>
        </PWView>
    )
}

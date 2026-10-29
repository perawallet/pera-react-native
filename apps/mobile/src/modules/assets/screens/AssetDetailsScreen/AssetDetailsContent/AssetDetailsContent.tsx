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

import { AssetMarkets } from '@modules/assets/components/market/AssetMarkets'
import { AssetHoldings } from '@modules/assets/components/holdings/AssetHoldings'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { createPWTabNavigator, PWText, PWView } from '@components/core'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { AccountHeaderMenu } from '@components/AccountHeaderMenu'
import { useStyles } from './styles'
import { useAssetDetailsScreen } from '../useAssetDetailsScreen'
import type { AssetDetailsScreenProps } from '../AssetDetailsScreen'

type AssetDetailsTabParamsList = {
    Holdings: undefined
    Markets: undefined
}

const Tab = createPWTabNavigator<AssetDetailsTabParamsList>()

export type AssetDetailsContentProps = NonNullable<
    AssetDetailsScreenProps['route']['params']
>

export const AssetDetailsContent = ({
    assetId,
    chainId,
    isCollectible = false,
}: AssetDetailsContentProps) => {
    const { t } = useLanguage()

    const styles = useStyles()

    const {
        account,
        asset,
        scope,
        isLoading,
        isError,
        headerPrimary,
        headerSecondary,
        assetDetailsDisplay,
        about,
        isNetworkLineVisible,
        isMarketsTabVisible,
    } = useAssetDetailsScreen({
        assetId,
        chainId,
        isCollectible,
    })

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

    if (isError) {
        return (
            <EmptyView
                title={t('asset_details.markets.something_went_wrong_title')}
                body={t('asset_details.markets.something_went_wrong_body')}
            />
        )
    }

    if (isLoading || !asset || !account || !about) {
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
            <Tab.Navigator>
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
                            scope={scope}
                            isCollectible={isCollectible}
                            isNetworkLineVisible={isNetworkLineVisible}
                        />
                    )}
                </Tab.Screen>

                {isMarketsTabVisible && (
                    <Tab.Screen
                        name='Markets'
                        options={{
                            title: t('asset_details.main_screen.markets_tab'),
                        }}
                    >
                        {() => (
                            <AssetMarkets
                                asset={asset}
                                scope={scope}
                                assetDetailsDisplay={assetDetailsDisplay}
                                about={about}
                                isNetworkLineVisible={isNetworkLineVisible}
                            />
                        )}
                    </Tab.Screen>
                )}
            </Tab.Navigator>
        </PWView>
    )
}

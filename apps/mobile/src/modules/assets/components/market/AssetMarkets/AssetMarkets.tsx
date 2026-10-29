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

import { formatDatetime, type Nullable } from '@perawallet/wallet-core-shared'
import {
    type AssetPriceHistoryItem,
    type PeraAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useStyles } from './styles'
import {
    AssetFavoriteButton,
    AssetNotificationButton,
    AssetTitle,
} from '@modules/assets/components'
import { ChainLabel } from '../../ChainLabel'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetPriceChart } from '../AssetPriceChart/AssetPriceChart'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { Decimal } from 'decimal.js'
import {
    PWIcon,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AssetMarketStats } from '../AssetMarketStats/AssetMarketStats'
import { AssetAbout } from '../AssetAbout/AssetAbout'
import { useLanguage } from '@hooks/useLanguage'
import { AssetDescription } from '../AssetDescription/AssetDescription'
import { AssetSocialMedia } from '../AssetSocialMedia/AssetSocialMedia'
import { PriceTrend } from '../PriceTrend/PriceTrend'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { EmptyView } from '@components/EmptyView'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { UserPreferences } from '@constants/user-preferences'
import { LoadingView } from '@components/LoadingView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { useCapability } from '@hooks/useCapability'
import { toDiscoverTokenDetailPath } from '@modules/discover'
import type {
    AssetAboutDisplay,
    AssetDetailsDisplay,
} from '@modules/assets/types/asset-details-display'

export type AssetMarketsProps = {
    asset: PeraAsset
    scope: ChainScope
    assetDetailsDisplay: AssetDetailsDisplay
    about: AssetAboutDisplay
    isNetworkLineVisible?: boolean
}

export const AssetMarkets = ({
    asset,
    scope,
    assetDetailsDisplay,
    about,
    isNetworkLineVisible = false,
}: AssetMarketsProps) => {
    const { VerificationSection, IssuerControlsSection } = assetDetailsDisplay
    const styles = useStyles()
    const currencyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency(currencyScope)
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AssetPriceHistoryItem>()

    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { getPreference } = usePreferences()
    const { t } = useLanguage()
    const canOpenDiscover = useCapability({
        platform: 'discoverTab',
        chain: { chainId: scope.chainId, capability: 'discover' },
    })

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const hasPriceHistory = useCapability({
        chain: { chainId: scope.chainId, capability: 'priceHistory' },
    })

    const {
        data: assetDetails,
        isError,
        isPending,
    } = useSingleAssetDetailsQuery(asset.assetId, scope)

    const openDiscover = () => {
        // Pushed over asset details (not the Discover tab, which swaps in
        // place and strands the user with no back affordance)
        navigation.navigate('DiscoverDetail', {
            path: toDiscoverTokenDetailPath(asset.assetId, scope.chainId),
        })
    }

    const handleDataPointSelection = (
        item: Nullable<AssetPriceHistoryItem>,
    ) => {
        setSelectedPoint(item)
    }

    if (isError && !assetDetails) {
        return (
            <EmptyView
                title={t('asset_details.markets.something_went_wrong_title')}
                body={t('asset_details.markets.something_went_wrong_body')}
            />
        )
    }

    if (isPending) {
        return (
            <LoadingView
                style={styles.loadingContainer}
                variant='skeleton'
                count={3}
            />
        )
    }

    if (!assetDetails) {
        return null
    }

    return (
        <PWScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            <PWView style={styles.header}>
                <PWView style={styles.assetRow}>
                    <AssetTitle asset={asset} />
                    <PWView style={styles.headerIcons}>
                        <AssetNotificationButton
                            assetId={asset.assetId}
                            scope={scope}
                            isNotificationsEnabled={
                                assetDetails?.peraMetadata?.isPriceAlertEnabled
                            }
                        />
                        <AssetFavoriteButton
                            assetId={asset.assetId}
                            scope={scope}
                            isFavorite={assetDetails?.peraMetadata?.isFavorited}
                        />
                    </PWView>
                </PWView>
                {isNetworkLineVisible && (
                    <ChainLabel
                        chainId={scope.chainId}
                        size='md'
                        style={styles.chainLabel}
                    />
                )}
                <PWView style={styles.priceContainer}>
                    <PWView>
                        {selectedPoint ? (
                            <PreferredAmount
                                variant='h1'
                                value={usdToPreferred(
                                    new Decimal(selectedPoint.usdPrice),
                                )}
                            />
                        ) : (
                            <PreferredAmount
                                variant='h1'
                                sourceAmount={new Decimal(1)}
                                sourceAssetId={asset.assetId}
                                scope={scope}
                            />
                        )}

                        <PWView style={styles.trendContainer}>
                            <PriceTrend
                                assetId={asset.assetId}
                                scope={scope}
                                period={period}
                                showAbsolute
                                selectedDataPoint={selectedPoint}
                            />
                            {!!selectedPoint && (
                                <PWText style={styles.dateDisplay}>
                                    {formatDatetime(selectedPoint.datetime)}
                                </PWText>
                            )}
                        </PWView>
                    </PWView>
                </PWView>
            </PWView>

            {hasPriceHistory && (
                <ExpandablePanel isExpanded={chartVisible}>
                    <PWView style={styles.chartContainer}>
                        <AssetPriceChart
                            asset={asset}
                            scope={scope}
                            period={period}
                            onSelectionChanged={handleDataPointSelection}
                        />
                        <ChartPeriodSelection
                            value={period}
                            onChange={setPeriod}
                        />
                    </PWView>
                </ExpandablePanel>
            )}

            {canOpenDiscover && (
                <PWTouchableOpacity
                    style={styles.discoverButton}
                    onPress={openDiscover}
                >
                    <PWText
                        style={styles.discoverText}
                        truncate
                    >
                        {t('asset_details.markets.discover_more')}
                    </PWText>
                    <PWView style={styles.discoverLink}>
                        <PWText
                            style={styles.discoverLinkText}
                            variant='h4'
                            truncate
                        >
                            {t('asset_details.markets.title')}
                        </PWText>
                        <PWIcon
                            name='chevron-right'
                            size='md'
                            variant='secondary'
                        />
                    </PWView>
                </PWTouchableOpacity>
            )}

            <AssetMarketStats
                assetDetails={assetDetails}
                scope={scope}
            />

            <AssetAbout
                assetDetails={assetDetails}
                about={about}
            />

            {!!VerificationSection && (
                <VerificationSection
                    asset={assetDetails}
                    scope={scope}
                />
            )}

            <AssetDescription
                description={assetDetails.peraMetadata?.description}
            />

            {!!IssuerControlsSection && (
                <IssuerControlsSection
                    asset={assetDetails}
                    scope={scope}
                />
            )}

            <AssetSocialMedia assetDetails={assetDetails} />
        </PWScrollView>
    )
}

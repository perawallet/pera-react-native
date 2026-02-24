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

import { useEffect } from 'react'
import { ScrollView } from 'react-native'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import {
    AssetFavoriteButton,
    AssetNotificationButton,
    AssetTitle,
} from '@modules/assets/components'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { AssetPriceChart } from '../AssetPriceChart/AssetPriceChart'
import { useChartInteraction } from '@hooks/useChartInteraction'
import Decimal from 'decimal.js'
import {
    PWButton,
    PWIcon,
    PWSkeleton,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AssetMarketStats } from '../AssetMarketStats/AssetMarketStats'
import { AssetAbout } from '../AssetAbout/AssetAbout'
import { AssetVerificationCard } from '../AssetVerificationCard/AssetVerificationCard'
import { useLanguage } from '@hooks/useLanguage'
import { AssetDescription } from '../AssetDescription/AssetDescription'
import { AssetSocialMedia } from '../AssetSocialMedia/AssetSocialMedia'
import { PriceTrend } from '../PriceTrend/PriceTrend'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { EmptyView } from '@components/EmptyView'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import {
    AssetPriceHistoryItem,
    PeraAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

export type AssetMarketsProps = {
    asset: PeraAsset
    onSwipeEnabledChange?: (enabled: boolean) => void
}

const Loading = () => {
    const styles = useStyles()
    return (
        <PWView style={styles.loadingContainer}>
            <PWSkeleton style={styles.skeleton} />
            <PWSkeleton style={styles.skeleton} />
            <PWSkeleton style={styles.skeleton} />
        </PWView>
    )
}

export const AssetMarkets = ({
    asset,
    onSwipeEnabledChange,
}: AssetMarketsProps) => {
    const styles = useStyles()
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AssetPriceHistoryItem>()

    useEffect(() => {
        onSwipeEnabledChange?.(!selectedPoint)
    }, [selectedPoint, onSwipeEnabledChange])

    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { getPreference, setPreference } = usePreferences()
    const { t } = useLanguage()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }

    const {
        data: assetDetails,
        isError,
        isPending,
    } = useSingleAssetDetailsQuery(asset.assetId)

    const openDiscover = () => {
        //TODO: pass relative URL to go straight to the asset
        navigation.navigate('TabBar', {
            screen: 'Discover',
        })
    }

    const handleDataPointSelection = (item: AssetPriceHistoryItem | null) => {
        setSelectedPoint(item)
    }

    if (isError) {
        return (
            <EmptyView
                title={t('asset_details.markets.something_went_wrong_title')}
                body={t('asset_details.markets.something_went_wrong_body')}
            />
        )
    }

    if (isPending) {
        return <Loading />
    }

    if (!assetDetails) {
        return null
    }

    return (
        <ScrollView
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
                            isNotificationsEnabled={
                                assetDetails?.peraMetadata?.isPriceAlertEnabled
                            }
                        />
                        <AssetFavoriteButton
                            assetId={asset.assetId}
                            isFavorite={assetDetails?.peraMetadata?.isFavorited}
                        />
                    </PWView>
                </PWView>
                <PWView style={styles.priceContainer}>
                    <PWView>
                        {selectedPoint ? (
                            <CurrencyDisplay
                                variant='h1'
                                value={usdToPreferred(
                                    new Decimal(selectedPoint.usdPrice),
                                )}
                                currency={preferredCurrency}
                                precision={6}
                                minPrecision={2}
                            />
                        ) : (
                            <PreferredCurrencyDisplay
                                variant='h1'
                                sourceAmount={new Decimal(1)}
                                sourceAssetId={asset.assetId}
                                precision={6}
                                minPrecision={2}
                            />
                        )}

                        <PWView style={styles.trendContainer}>
                            <PriceTrend
                                assetId={asset.assetId}
                                period={period}
                                showAbsolute
                                selectedDataPoint={selectedPoint}
                            />
                            {!!selectedPoint && (
                                <PWText>
                                    {formatDatetime(selectedPoint.datetime)}
                                </PWText>
                            )}
                        </PWView>
                    </PWView>
                    <PWButton
                        icon='chart'
                        variant={chartVisible ? 'secondary' : 'helper'}
                        paddingStyle='dense'
                        onPress={toggleChartVisible}
                    />
                </PWView>
            </PWView>

            {chartVisible && (
                <PWView style={styles.chartContainer}>
                    <AssetPriceChart
                        asset={asset}
                        period={period}
                        onSelectionChanged={handleDataPointSelection}
                    />
                    <ChartPeriodSelection
                        value={period}
                        onChange={setPeriod}
                    />
                </PWView>
            )}

            <PWTouchableOpacity
                style={styles.discoverButton}
                onPress={openDiscover}
            >
                <PWText style={styles.discoverText}>
                    {t('asset_details.markets.discover_more')}
                </PWText>
                <PWView style={styles.discoverLink}>
                    <PWText
                        style={styles.discoverLinkText}
                        variant='h4'
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

            <AssetMarketStats assetDetails={assetDetails} />

            <AssetAbout assetDetails={assetDetails} />

            <AssetVerificationCard assetDetails={assetDetails} />

            <AssetDescription
                description={assetDetails.peraMetadata?.description ?? ''}
            />

            <AssetSocialMedia assetDetails={assetDetails} />

            {/* TODO: Add this in when we have the metadata on the asset */}
            {/* <PWView style={styles.tagsContainer}>
                {!assetDetails.is_frozen && <PWView style={styles.tag}>
                    <PWIcon
                        name='snowflake'
                        size="sm"
                        variant='secondary'
                    />
                    <Text style={styles.tagText}>{t('asset_details.markets.no_freeze')}</Text>
                </PWView>}
                {!assetDetails.is_clawback && <PWView style={styles.tag}>
                    <PWIcon
                        name='undo'
                        size="sm"
                        variant='secondary'
                    />
                    <Text style={styles.tagText}>{t('asset_details.markets.no_clawback')}</Text>
                </PWView>}
            </PWView> */}
        </ScrollView>
    )
}

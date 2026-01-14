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

import { ScrollView } from 'react-native'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import AssetTitle from '../../AssetTitle'
import RoundButton from '@components/RoundButton'
import CurrencyDisplay from '@components/CurrencyDisplay'
import AssetPriceChart from '../AssetPriceChart/AssetPriceChart'
import { useMemo, useCallback } from 'react'
import { useChartInteraction } from '@hooks/chart-interaction'
import Decimal from 'decimal.js'
import { Skeleton, Text } from '@rneui/themed'
import AssetMarketStats from '../AssetMarketStats/AssetMarketStats'
import AssetAbout from '../AssetAbout/AssetAbout'
import AssetVerificationCard from '../AssetVerificationCard/AssetVerificationCard'
import { useLanguage } from '@hooks/language'
import AssetDescription from '../AssetDescription/AssetDescription'
import AssetSocialMedia from '../AssetSocialMedia/AssetSocialMedia'
import PriceTrend from '../PriceTrend/PriceTrend'
import PWTouchableOpacity from '@components/PWTouchableOpacity'
import PWIcon from '@components/PWIcon'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useToast from '@hooks/toast'
import PWView from '@components/PWView'
import EmptyView from '@components/EmptyView'
import ChartPeriodSelection from '@components/ChartPeriodSelection'
import {
    AssetPriceHistoryItem,
    PeraAsset,
    useAssetFiatPricesQuery,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import PWButton from '@components/PWButton'

type AssetMarketsProps = {
    asset: PeraAsset
}

const Loading = () => {
    const styles = useStyles()
    return (
        <PWView style={styles.loadingContainer}>
            <Skeleton style={styles.skeleton} />
            <Skeleton style={styles.skeleton} />
            <Skeleton style={styles.skeleton} />
        </PWView>
    )
}

const AssetMarkets = ({ asset }: AssetMarketsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AssetPriceHistoryItem>()
    const { showToast } = useToast()
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
    const { data: prices } = useAssetFiatPricesQuery()
    const fiatPrice = useMemo(
        () => prices.get(asset.assetId) ?? null,
        [asset, prices],
    )

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }, [showToast, t])

    const currentPrice = useMemo(() => {
        if (selectedPoint) {
            return new Decimal(selectedPoint.fiatPrice)
        }
        return fiatPrice?.fiatPrice ?? null
    }, [selectedPoint, fiatPrice])

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
                        <RoundButton
                            icon='bell'
                            size='sm'
                            variant='secondary'
                            onPress={notImplemented}
                        />
                        <RoundButton
                            icon='star'
                            size='sm'
                            variant='secondary'
                            onPress={notImplemented}
                        />
                    </PWView>
                </PWView>
                <PWView style={styles.priceContainer}>
                    <PWView>
                        <CurrencyDisplay
                            h1
                            value={currentPrice}
                            currency={preferredCurrency}
                            precision={6}
                            minPrecision={2}
                        />

                        <PWView style={styles.trendContainer}>
                            <PriceTrend
                                assetId={asset.assetId}
                                period={period}
                                showAbsolute
                                selectedDataPoint={selectedPoint}
                            />
                            {!!selectedPoint && (
                                <Text>
                                    {formatDatetime(selectedPoint.datetime)}
                                </Text>
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
                <Text style={styles.discoverText}>
                    {t('asset_details.markets.discover_more')}
                </Text>
                <PWView style={styles.discoverLink}>
                    <Text
                        style={styles.discoverLinkText}
                        h4
                    >
                        {t('asset_details.markets.title')}
                    </Text>
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

export default AssetMarkets

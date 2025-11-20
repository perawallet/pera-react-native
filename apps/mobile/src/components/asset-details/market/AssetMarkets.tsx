import { ScrollView } from 'react-native'
import {
    PeraAsset,
    useAssetDetails,
    useCurrencyConverter,
    ALGO_ASSET_ID,
    ALGO_ASSET,
    AssetPriceChartDataItem,
    formatDatetime,
} from '@perawallet/core'
import { useStyles } from './styles'
import AssetTitle from '../../assets/asset-title/AssetTitle'
import RoundButton from '../../common/round-button/RoundButton'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import AssetPriceChart from '../holdings/asset-price-chart/AssetPriceChart'
import ChartPeriodSelection, {
    ChartPeriod,
    ChartPeriods,
} from '../../common/chart-period-selection/ChartPeriodSelection'
import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import { Skeleton, Text } from '@rneui/themed'
import AssetMarketStats from './asset-market-stats/AssetMarketStats'
import AssetAbout from './asset-about/AssetAbout'
import AssetVerificationCard from './asset-verification-card/AssetVerificationCard'
import AssetDescription from './asset-description/AssetDescription'
import AssetSocialMedia from './asset-social-media/AssetSocialMedia'
import PriceTrend from './price-trend/PriceTrend'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import PWIcon from '../../common/icons/PWIcon'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useToast from '../../../hooks/toast'
import PWView from '../../common/view/PWView'
import EmptyView from '../../common/empty-view/EmptyView'

type AssetMarketsProps = {
    asset: PeraAsset
}

const Loading = () => {
    const styles = useStyles()
    return <PWView style={styles.loadingContainer}>
        <Skeleton style={styles.skeleton} />
        <Skeleton style={styles.skeleton} />
        <Skeleton style={styles.skeleton} />
    </PWView>
}

const AssetMarkets = ({ asset }: AssetMarketsProps) => {
    const styles = useStyles()
    const { preferredCurrency, convertUSDToPreferredCurrency } =
        useCurrencyConverter()
    const [period, setPeriod] = useState<ChartPeriod>(ChartPeriods.OneWeek)
    const [selectedPoint, setSelectedPoint] = useState<AssetPriceChartDataItem>()
    const { showToast } = useToast()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { data: assetDetails, isError, isPending } = useAssetDetails({
        asset_id: asset.asset_id,
    })

    const notImplemented = () => {
        showToast({
            title: 'Not implemented',
            body: 'This feature is not implemented yet',
            type: 'error',
        })
    }

    const currentPrice = useMemo(() => {
        if (selectedPoint) {
            return new Decimal(selectedPoint.price)
        }
        return convertUSDToPreferredCurrency(
            new Decimal(assetDetails?.usd_value ?? 0),
        )
    }, [selectedPoint, assetDetails, convertUSDToPreferredCurrency])

    const openDiscover = () => {
        //TODO: pass relative URL to go straight to the asset
        navigation.navigate('TabBar', {
            screen: 'Discover',
        })
    }

    const handleDataPointSelection = (item: AssetPriceChartDataItem | null) => {
        setSelectedPoint(item ?? undefined)
    }

    if (isError) {
        return <EmptyView title='Something went wrong'
            body="We were unable to load this asset's details. Please check your connection and try again." />
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

                <CurrencyDisplay
                    h1
                    value={currentPrice}
                    currency={preferredCurrency}
                    precision={6}
                    minPrecision={2}
                />

                <PWView style={styles.trendContainer}>
                    <PriceTrend assetId={asset.asset_id} period={period} showAbsolute selectedDataPoint={selectedPoint} />
                    {!!selectedPoint && <Text>{formatDatetime(selectedPoint.datetime)}</Text>}
                </PWView>
            </PWView>

            <PWView style={styles.chartContainer}>
                <AssetPriceChart
                    asset={asset}
                    period={period}
                    onSelectionChanged={handleDataPointSelection}
                />
                <ChartPeriodSelection value={period} onChange={setPeriod} />
            </PWView>

            <PWTouchableOpacity
                style={styles.discoverButton}
                onPress={openDiscover}
            >
                <Text style={styles.discoverText}>
                    See more details on Discover
                </Text>
                <PWView style={styles.discoverLink}>
                    <Text style={styles.discoverLinkText} h4>Markets</Text>
                    <PWIcon
                        name='chevron-right'
                        size="md"
                        variant='secondary'
                    />
                </PWView>
            </PWTouchableOpacity>

            <AssetMarketStats assetDetails={assetDetails} />

            <AssetAbout assetDetails={assetDetails} />

            <AssetVerificationCard assetDetails={assetDetails} />

            <AssetDescription description={assetDetails.description} />

            <AssetSocialMedia assetDetails={assetDetails} />

            <PWView style={styles.tagsContainer}>
                {assetDetails.is_frozen && <PWView style={styles.tag}>
                    <PWIcon
                        name='snowflake'
                        size="sm"
                        variant='secondary'
                    />
                    <Text style={styles.tagText}>No Freeze</Text>
                </PWView>}
                {assetDetails.is_clawback && <PWView style={styles.tag}>
                    <PWIcon
                        name='undo'
                        size="sm"
                        variant='secondary'
                    />
                    <Text style={styles.tagText}>No Clawback</Text>
                </PWView>}
            </PWView>
        </ScrollView>
    )
}

export default AssetMarkets

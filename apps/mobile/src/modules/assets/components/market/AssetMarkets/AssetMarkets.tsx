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
import { useStyles } from './styles'
import {
    AssetFavoriteButton,
    AssetNotificationButton,
    AssetTitle,
} from '@modules/assets/components'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetPriceChart } from '../AssetPriceChart/AssetPriceChart'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { Decimal } from 'decimal.js'
import {
    type IconName,
    PWIcon,
    PWScrollView,
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
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { EmptyView } from '@components/EmptyView'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import {
    type AssetPriceHistoryItem,
    type PeraAsset,
    useAssetChainRolesQuery,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { LoadingView } from '@components/LoadingView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { routeCapabilities } from '@routes/capabilities'

export type AssetMarketsProps = {
    asset: PeraAsset
}

const Loading = () => {
    const styles = useStyles()
    return (
        <LoadingView
            style={styles.loadingContainer}
            variant='skeleton'
            count={3}
        />
    )
}

type RoleTagProps = {
    icon: IconName
    label: string
    /** The creator kept this role, so it's a caution, not a reassurance. */
    isPresent: boolean
}

const RoleTag = ({ icon, label, isPresent }: RoleTagProps) => {
    const styles = useStyles()
    return (
        <PWView style={[styles.tag, isPresent && styles.tagPresent]}>
            <PWIcon
                name={icon}
                size='sm'
                variant={isPresent ? 'error' : 'secondary'}
            />
            <PWText
                style={[styles.tagText, isPresent && styles.tagTextPresent]}
            >
                {label}
            </PWText>
        </PWView>
    )
}

export const AssetMarkets = ({ asset }: AssetMarketsProps) => {
    const styles = useStyles()
    const { usdToPreferred } = useCurrency()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AssetPriceHistoryItem>()

    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { getPreference } = usePreferences()
    const { t } = useLanguage()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)

    const {
        data: assetDetails,
        isError,
        isPending,
    } = useSingleAssetDetailsQuery(asset.assetId)

    const { data: chainRoles } = useAssetChainRolesQuery(asset.assetId)

    const openDiscover = () => {
        // mirror native: deep-link straight to the asset's token detail page
        navigation.navigate('TabBar', {
            screen: 'Discover',
            params: { path: `token-detail/${asset.assetId}` },
        })
    }

    const handleDataPointSelection = (
        item: Nullable<AssetPriceHistoryItem>,
    ) => {
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
                                <PWText style={styles.dateDisplay}>
                                    {formatDatetime(selectedPoint.datetime)}
                                </PWText>
                            )}
                        </PWView>
                    </PWView>
                </PWView>
            </PWView>

            <ExpandablePanel isExpanded={chartVisible}>
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
            </ExpandablePanel>

            {routeCapabilities.discoverTab && (
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

            <AssetMarketStats assetDetails={assetDetails} />

            <AssetAbout assetDetails={assetDetails} />

            <AssetVerificationCard assetDetails={assetDetails} />

            <AssetDescription
                description={assetDetails.peraMetadata?.description}
            />

            <AssetSocialMedia assetDetails={assetDetails} />

            {/* Withheld rather than defaulted while the roles are unknown: a
                "No Freeze" tag is a safety claim about the reader's funds. */}
            {!!chainRoles && (
                <PWView style={styles.tagsContainer}>
                    <RoleTag
                        icon='snowflake'
                        isPresent={chainRoles.hasFreeze}
                        label={
                            chainRoles.hasFreeze
                                ? t('asset_details.markets.freeze')
                                : t('asset_details.markets.no_freeze')
                        }
                    />
                    <RoleTag
                        icon='undo'
                        isPresent={chainRoles.hasClawback}
                        label={
                            chainRoles.hasClawback
                                ? t('asset_details.markets.clawback')
                                : t('asset_details.markets.no_clawback')
                        }
                    />
                </PWView>
            )}
        </PWScrollView>
    )
}

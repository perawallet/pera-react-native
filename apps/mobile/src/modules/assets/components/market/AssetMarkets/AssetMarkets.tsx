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

import type { Nullable } from '@perawallet/wallet-core-shared'
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
import { ChainLabel } from '@modules/chain-ui/icon'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetPriceChart } from '../AssetPriceChart/AssetPriceChart'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { Decimal } from 'decimal.js'
import { PWScrollView, PWView } from '@components/core'
import { AssetMarketStats } from '../AssetMarketStats/AssetMarketStats'
import { AssetAbout } from '../AssetAbout/AssetAbout'
import { useLanguage } from '@hooks/useLanguage'
import { AssetDescription } from '../AssetDescription/AssetDescription'
import { AssetSocialMedia } from '../AssetSocialMedia/AssetSocialMedia'
import { PriceTrend } from '../PriceTrend/PriceTrend'
import { EmptyView } from '@components/EmptyView'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { UserPreferences } from '@constants/user-preferences'
import { LoadingView } from '@components/LoadingView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { useCapability } from '@hooks/useCapability'
import type {
    AssetAboutDisplay,
    AssetDetailsDisplay,
    AssetSupplyDisplay,
} from '@modules/assets/types/asset-details-display'

export type AssetMarketsProps = {
    asset: PeraAsset
    scope: ChainScope
    assetDetailsDisplay: AssetDetailsDisplay
    about: AssetAboutDisplay
    supply: AssetSupplyDisplay
    isNetworkLineVisible?: boolean
}

export const AssetMarkets = ({
    asset,
    scope,
    assetDetailsDisplay,
    about,
    supply,
    isNetworkLineVisible = false,
}: AssetMarketsProps) => {
    const { VerificationSection, IssuerControlsSection } = assetDetailsDisplay
    const styles = useStyles()
    const currencyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency(currencyScope)
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AssetPriceHistoryItem>()

    const { getPreference } = usePreferences()
    const { t } = useLanguage()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const hasPriceHistory = useCapability({
        chain: { chainId: scope.chainId, capability: 'priceHistory' },
    })

    const {
        data: assetDetails,
        isError,
        isPending,
    } = useSingleAssetDetailsQuery(asset.assetId, scope)

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
                    <AssetTitle
                        asset={asset}
                        chainId={scope.chainId}
                        nameVariant='h3'
                        nameWeight={400}
                    />
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
                                density='unitPrice'
                                value={usdToPreferred(
                                    new Decimal(selectedPoint.usdPrice),
                                )}
                            />
                        ) : (
                            <PreferredAmount
                                variant='h1'
                                density='unitPrice'
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

            <AssetMarketStats
                assetDetails={assetDetails}
                scope={scope}
                supply={supply}
            />

            <AssetAbout
                assetDetails={assetDetails}
                about={about}
                assetScope={scope}
            />

            {!!VerificationSection && (
                <VerificationSection
                    asset={assetDetails}
                    scope={scope}
                />
            )}

            <AssetDescription
                description={
                    assetDetails.peraMetadata?.description ||
                    (about.descriptionKey ? t(about.descriptionKey) : undefined)
                }
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

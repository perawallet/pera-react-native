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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { AssetWealthChart } from '../AssetWealthChart/AssetWealthChart'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { AssetActionButtons } from '../AssetActionButtons/AssetActionButtons'
import { AssetTransactionList } from '../AssetTransactionList/AssetTransactionList'

import { useStyles } from './styles'
import { useAssetHoldings } from './useAssetHoldings'
import {
    AssetFavoriteButton,
    AssetNotificationButton,
    AssetTitle,
} from '@modules/assets/components'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { WealthTrend } from '@components/WealthTrend'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { InfoCallout } from '@components/InfoCallout'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

export type AssetHoldingsProps = {
    account: WalletAccount
    asset: PeraAsset
    scope: ChainScope
    isCollectible?: boolean
}

export const AssetHoldings = ({
    account,
    asset,
    scope,
    isCollectible,
}: AssetHoldingsProps) => {
    const styles = useStyles()
    const {
        assetHolding,
        holdingAmount,
        tokenAmount,
        isPriced,
        hasBalanceHistory,
        isChartShown,
        period,
        trendPeriod,
        setPeriod,
        selectedPoint,
        setSelectedPoint,
        isValueShown,
        toggleAmount,
        amountHint,
        canCopyAmount,
        handleCopyAmount,
        tokenWarning,
    } = useAssetHoldings({ account, asset, scope })

    // A scrubbed point with no preferred value has no rate behind it: null renders the placeholder, never 0.
    const value = selectedPoint ? (
        <PreferredAmount
            testID='asset_holdings_fiat_value'
            variant='h1'
            value={selectedPoint.preferredValue}
            density='compact'
            shouldFitWidth
        />
    ) : (
        <PreferredAmount
            testID='asset_holdings_fiat_value'
            variant='h1'
            sourceAmount={holdingAmount}
            sourceAssetId={asset.assetId}
            scope={scope}
            density='compact'
            shouldFitWidth
        />
    )

    return (
        <AssetTransactionList
            account={account}
            asset={asset}
            scope={scope}
        >
            <PWView style={styles.contentContainer}>
                <PWView
                    style={styles.header}
                    testID='asset_holdings_header'
                >
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
                                    asset.peraMetadata?.isPriceAlertEnabled
                                }
                            />
                            <AssetFavoriteButton
                                assetId={asset.assetId}
                                scope={scope}
                                isFavorite={asset.peraMetadata?.isFavorited}
                            />
                        </PWView>
                    </PWView>

                    <PWTouchableOpacity
                        testID='asset_holdings_amount'
                        style={styles.amountRow}
                        activeOpacity={isPriced ? undefined : 1}
                        disabled={!isPriced && !canCopyAmount}
                        onPress={isPriced ? toggleAmount : undefined}
                        // A display toggle: every tap must flip it back.
                        allowRapidPress
                        onLongPress={
                            canCopyAmount ? handleCopyAmount : undefined
                        }
                        accessibilityHint={amountHint}
                    >
                        {isValueShown ? (
                            value
                        ) : (
                            <AssetAmount
                                testID='asset_holdings_token_amount'
                                chainId={scope.chainId}
                                variant='h1'
                                value={tokenAmount}
                                asset={asset}
                                shouldFitWidth
                            />
                        )}
                        {isPriced && (
                            <PWIcon
                                name='chevron-up-down'
                                size='md'
                                style={styles.amountToggleIcon}
                            />
                        )}
                    </PWTouchableOpacity>

                    {/* Follows the amount above: the value's change, or the amount held's. */}
                    <PWView style={styles.trendContainer}>
                        <WealthTrend
                            holding={{
                                account,
                                assetId: asset.assetId,
                                scope,
                            }}
                            amountOf={isValueShown ? undefined : asset}
                            period={trendPeriod}
                            selectedValue={
                                isValueShown
                                    ? selectedPoint?.preferredValue
                                    : selectedPoint?.amount
                            }
                        />
                    </PWView>
                </PWView>

                {hasBalanceHistory && (
                    <ExpandablePanel isExpanded={isChartShown}>
                        <PWView style={styles.chartContainer}>
                            <AssetWealthChart
                                account={account}
                                asset={asset}
                                scope={scope}
                                period={period}
                                onSelectionChanged={setSelectedPoint}
                            />
                            <ChartPeriodSelection
                                value={period}
                                onChange={setPeriod}
                            />
                        </PWView>
                    </ExpandablePanel>
                )}

                {tokenWarning && (
                    <InfoCallout
                        icon='shield-warning'
                        iconVariant='error'
                        title={tokenWarning.title}
                        body={tokenWarning.body}
                        style={styles.tokenWarning}
                        testID='asset_holdings_token_warning'
                    />
                )}

                <AssetActionButtons
                    asset={asset}
                    assetHolding={assetHolding}
                    chainId={scope.chainId}
                    isCollectible={isCollectible}
                />
            </PWView>
        </AssetTransactionList>
    )
}

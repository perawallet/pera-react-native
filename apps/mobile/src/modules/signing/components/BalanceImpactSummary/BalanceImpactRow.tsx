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

import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { useLanguage } from '@hooks/useLanguage'
import type { BalanceImpactItem } from './useBalanceImpactSummary'
import { useStyles } from './styles'

type BalanceImpactRowProps = {
    item: BalanceImpactItem
}

export const BalanceImpactRow = ({ item }: BalanceImpactRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const sign = item.direction === 'receive' ? '+' : '-'

    return (
        <PWView style={styles.row}>
            <AssetIcon
                asset={item.asset}
                size='lg'
                shape={item.isCollectible ? 'square' : 'circle'}
            />
            <PWView style={styles.rowText}>
                {item.isCollectible ? (
                    <>
                        <PWText
                            variant='body'
                            numberOfLines={1}
                        >
                            {item.collectibleTitle}
                        </PWText>
                        {!!item.collectibleSubtitle && (
                            <PWText
                                variant='caption'
                                style={styles.subtitle}
                                numberOfLines={1}
                            >
                                {item.collectibleSubtitle}
                            </PWText>
                        )}
                    </>
                ) : item.isFullBalance ? (
                    // A close-remainder/close-to sweeps the whole balance, so the
                    // explicit `amount` understates the outflow — present it as the
                    // full balance instead of a misleadingly small figure.
                    <>
                        <PWText
                            variant='body'
                            numberOfLines={1}
                        >
                            {t('signing.balance_impact.entire_balance', {
                                unit: item.asset.unitName ?? item.assetId,
                            })}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.subtitle}
                            numberOfLines={1}
                        >
                            {t('signing.balance_impact.closes_balance')}
                        </PWText>
                    </>
                ) : (
                    <>
                        {/* Sign sits after the asset symbol (e.g. "¦ -0.1"),
                            matching the single-transaction summary header. */}
                        <AssetAmount
                            asset={item.asset}
                            value={item.amount}
                            sign={sign}
                            numberOfLines={1}
                        />
                        {item.isNewAsset ? (
                            <PWText
                                variant='caption'
                                style={styles.subtitle}
                                numberOfLines={1}
                            >
                                {t('signing.balance_impact.new_asset')}
                            </PWText>
                        ) : (
                            <PreferredAmount
                                sourceAmount={item.amount}
                                sourceAssetId={item.assetId}
                                usdPrice={item.usdPrice}
                                variant='caption'
                                style={styles.subtitle}
                            />
                        )}
                    </>
                )}
            </PWView>
        </PWView>
    )
}

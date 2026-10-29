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

import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { BalanceImpactItem } from '../useBalanceImpactSummary'
import { useStyles } from '../styles'
import { signOf } from '../signOf'
import { BalanceImpactSubtitle } from '../BalanceImpactSubtitle'

export type AmountRowTextProps = {
    item: BalanceImpactItem
}

export const AmountRowText = ({ item }: AmountRowTextProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <>
            {/* Sign sits after the asset symbol (e.g. "¦ -0.1"), matching the
                single-transaction summary header. */}
            <AssetAmount
                chainId={item.chainId}
                asset={item.asset}
                value={item.amount}
                sign={signOf(item)}
                numberOfLines={1}
            />
            {item.isNewAsset ? (
                <BalanceImpactSubtitle>
                    {t('signing.balance_impact.new_asset')}
                </BalanceImpactSubtitle>
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
    )
}

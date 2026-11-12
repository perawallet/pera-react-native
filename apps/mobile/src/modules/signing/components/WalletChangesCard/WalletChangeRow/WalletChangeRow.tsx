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

import { Decimal } from 'decimal.js'
import type { Optional } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { AssetIcon } from '@components/AssetIcon'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { BalanceImpactItem } from '../../BalanceImpactSummary'
import { CollectibleRowText } from '../../BalanceImpactSummary/CollectibleRowText'
import { FullBalanceRowText } from '../../BalanceImpactSummary/FullBalanceRowText'
import { useStyles } from './styles'

// An estimate past 6 dp is noise, and the long figure runs into the fiat beside it.
const MAX_DECIMALS = 6
const DUST_DIGITS = 2

const estimateOf = (amount: Decimal): Decimal => {
    if (amount.decimalPlaces() <= MAX_DECIMALS) return amount
    const rounded = amount.toDecimalPlaces(MAX_DECIMALS, Decimal.ROUND_DOWN)
    return rounded.isZero() ? amount.toSignificantDigits(DUST_DIGITS) : rounded
}

export type WalletChangeRowProps = {
    label: string
    /** Unset when nothing moves on this side. */
    item?: Optional<BalanceImpactItem>
    testID?: string
}

export const WalletChangeRow = ({
    label,
    item,
    testID,
}: WalletChangeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const isPlainAmount = !!item && !item.isCollectible && !item.isFullBalance

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            {item ? (
                <AssetIcon
                    chainId={item.chainId}
                    asset={item.asset}
                    size='lg'
                    shape={item.isCollectible ? 'square' : 'circle'}
                />
            ) : (
                <PWView style={styles.emptyIcon}>
                    <PWIcon
                        name='minus'
                        size='sm'
                        variant='secondary'
                    />
                </PWView>
            )}
            <PWView style={styles.info}>
                <PWText style={styles.label}>{label}</PWText>
                {!item && (
                    <PWText
                        variant='h3'
                        weight={600}
                        style={styles.amount}
                    >
                        {t('signing.review.nothing')}
                    </PWText>
                )}
                {isPlainAmount && (
                    <AssetAmount
                        chainId={item.chainId}
                        asset={item.asset}
                        value={estimateOf(item.amount)}
                        variant='h3'
                        weight={600}
                        style={styles.amount}
                        numberOfLines={1}
                    />
                )}
                {item?.isCollectible && <CollectibleRowText item={item} />}
                {item && !item.isCollectible && item.isFullBalance && (
                    <FullBalanceRowText item={item} />
                )}
            </PWView>
            {isPlainAmount && item.isNewAsset && (
                <PWText
                    variant='captionMedium'
                    weight={400}
                    style={styles.fiat}
                >
                    {t('signing.balance_impact.new_asset')}
                </PWText>
            )}
            {isPlainAmount && !item.isNewAsset && (
                <PreferredAmount
                    sourceAmount={item.amount}
                    sourceAssetId={item.assetId}
                    usdPrice={item.usdPrice}
                    variant='bodyLarge'
                    style={styles.fiat}
                />
            )}
        </PWView>
    )
}

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

import type { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetTierChip } from '@modules/assets'
import { useStyles } from './styles'

type SwapAssetSectionProps = {
    asset: Optional<PeraAsset>
    chainId: ChainId
    amountDisplay: string
    fiatValue: Nullable<Decimal>
    unitName?: string
    verificationTier: string
}

export const SwapAssetSection = ({
    asset,
    chainId,
    amountDisplay,
    fiatValue,
    unitName,
    verificationTier,
}: SwapAssetSectionProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.assetSection}>
            <PWView style={styles.assetRow}>
                <PWView style={styles.assetAmountContainer}>
                    {asset && (
                        <AssetIcon
                            chainId={chainId}
                            asset={asset}
                            size='lg'
                        />
                    )}
                    <PWView style={styles.amountTextContainer}>
                        <PWText
                            variant='h3'
                            style={styles.assetAmount}
                        >
                            {amountDisplay}
                        </PWText>
                        {fiatValue && (
                            <PreferredAmount
                                value={fiatValue}
                                variant='caption'
                                style={styles.usdValue}
                                ignorePrivacyMode
                            />
                        )}
                    </PWView>
                </PWView>
                <AssetTierChip
                    unitName={unitName}
                    verificationTier={verificationTier}
                    size='md'
                />
            </PWView>
        </PWView>
    )
}

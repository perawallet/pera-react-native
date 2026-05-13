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

import { PWText, PWView } from '@components/core'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { AssetTierChip } from '@modules/assets/components/AssetTierChip'
import { useStyles } from './styles'

type SwapAssetSectionProps = {
    asset: Optional<PeraAsset>
    amountDisplay: string
    fiatDisplay: Optional<string>
    unitName?: string
    verificationTier: string
}

export const SwapAssetSection = ({
    asset,
    amountDisplay,
    fiatDisplay,
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
                        {fiatDisplay && (
                            <PWText
                                variant='caption'
                                style={styles.usdValue}
                            >
                                {fiatDisplay}
                            </PWText>
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

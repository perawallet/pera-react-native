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
import type { SwapAsset } from '@perawallet/wallet-core-swaps'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { AssetIcon } from '@components/AssetIcon'
import { PreferredAmount } from '@components/PreferredAmount'
import { AssetTierChip } from '@modules/assets'
import { swapAssetIconSource } from '../../utils/swapAssetIconSource'
import { useStyles } from './styles'

type SwapAssetSectionProps = {
    asset: Optional<PeraAsset>
    swapAsset: SwapAsset
    chainId: ChainId
    amountDisplay: string
    fiatValue: Nullable<Decimal>
}

export const SwapAssetSection = ({
    asset,
    swapAsset,
    chainId,
    amountDisplay,
    fiatValue,
}: SwapAssetSectionProps) => {
    const styles = useStyles()
    const icon = swapAssetIconSource(asset, swapAsset)

    return (
        <PWView style={styles.assetSection}>
            <PWView style={styles.assetRow}>
                <PWView style={styles.assetAmountContainer}>
                    <AssetIcon
                        chainId={chainId}
                        asset={icon.asset}
                        logoUrl={icon.logoUrl}
                        size='lg'
                    />
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
                    unitName={swapAsset.unitName}
                    verificationTier={swapAsset.verificationTier}
                    size='md'
                />
            </PWView>
        </PWView>
    )
}

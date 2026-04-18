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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import { isAlgoAsset } from '@perawallet/wallet-core-assets'
import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { CopyableText } from '@components/CopyableText'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import { AssetIcon } from '@modules/assets/components'
import { useStyles } from './styles'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type SwapToAssetItemViewProps = {
    dexAsset: DexSwapAsset
    balance: Nullable<Decimal>
} & PWTouchableOpacityProps

export const SwapToAssetItemView = ({
    dexAsset,
    balance,
    onPress,
    ...rest
}: SwapToAssetItemViewProps) => {
    const styles = useStyles()

    const assetIdStr = String(dexAsset.assetId)
    const isAlgo = isAlgoAsset(dexAsset.assetId)

    const verificationIconName = useMemo(() => {
        if (isAlgo) return 'assets/trusted' as const
        return getVerificationIcon(dexAsset.verificationTier)
    }, [isAlgo, dexAsset.verificationTier])

    return (
        <PWTouchableOpacity
            onPress={onPress}
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AssetIcon
                asset={dexAsset}
                logoUrl={dexAsset.logo}
                size='lg'
            />
            <PWView style={styles.dataContainer}>
                <PWView style={styles.unitContainer}>
                    <PWView style={styles.row}>
                        <PWText
                            style={styles.primaryUnit}
                            numberOfLines={1}
                        >
                            {isAlgo ? 'Algo' : dexAsset.name}
                        </PWText>
                        {verificationIconName ? (
                            <PWIcon
                                name={verificationIconName}
                                size='xs'
                            />
                        ) : null}
                    </PWView>
                    <CopyableText copyValue={assetIdStr}>
                        <PWText
                            style={styles.secondaryUnit}
                            numberOfLines={1}
                        >
                            {dexAsset.unitName}
                            {dexAsset.assetId !== 0 && ` - ${assetIdStr}`}
                        </PWText>
                    </CopyableText>
                </PWView>
                {balance !== null ? (
                    <PWView style={styles.amountContainer}>
                        <CurrencyDisplay
                            currency={dexAsset.unitName ?? ''}
                            value={balance}
                            precision={dexAsset.decimals ?? 0}
                            minPrecision={2}
                            showSymbol
                            style={styles.primaryAmount}
                        />
                        <PreferredCurrencyDisplay
                            sourceAmount={balance}
                            sourceAssetId={assetIdStr}
                            precision={2}
                            minPrecision={2}
                            showSymbol
                            style={styles.secondaryAmount}
                        />
                    </PWView>
                ) : null}
            </PWView>
        </PWTouchableOpacity>
    )
}

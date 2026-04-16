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

import { useCallback, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useTheme } from '@rneui/themed'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { CopyableText } from '@components/CopyableText'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import AlgoAssetIcon from '@assets/icons/assets/algo.svg'
import { useStyles } from './styles'

export type SwapToAssetItemViewProps = {
    dexAsset: DexSwapAsset
    balance: Decimal | null
} & PWTouchableOpacityProps

export const SwapToAssetItemView = ({
    dexAsset,
    balance,
    onPress,
    ...rest
}: SwapToAssetItemViewProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const iconSize = theme.spacing.xxl
    const [logoLoadFailed, setLogoLoadFailed] = useState(false)

    const handleImageError = useCallback(() => {
        setLogoLoadFailed(true)
    }, [])

    const assetIdStr = String(dexAsset.assetId)
    const isAlgo = assetIdStr === ALGO_ASSET_ID

    const initials = useMemo(
        () =>
            (dexAsset.unitName ?? dexAsset.name ?? '?')
                .slice(0, 2)
                .toUpperCase(),
        [dexAsset.unitName, dexAsset.name],
    )

    const verificationIconName = useMemo(() => {
        if (isAlgo) return 'assets/trusted' as const
        return getVerificationIcon(dexAsset.verificationTier)
    }, [isAlgo, dexAsset.verificationTier])

    const logoIcon = useMemo(() => {
        if (isAlgo) {
            return (
                <AlgoAssetIcon
                    style={styles.icon}
                    width={iconSize}
                    height={iconSize}
                />
            )
        }
        if (dexAsset.logo && !logoLoadFailed) {
            return (
                <PWImage
                    resizeMode='contain'
                    source={{ uri: dexAsset.logo }}
                    style={styles.imageIcon}
                    onError={handleImageError}
                />
            )
        }
        return (
            <PWView style={styles.defaultAsset}>
                <PWText
                    variant='caption'
                    style={styles.initialsText}
                >
                    {initials}
                </PWText>
            </PWView>
        )
    }, [
        isAlgo,
        dexAsset.logo,
        logoLoadFailed,
        handleImageError,
        initials,
        styles,
    ])

    return (
        <PWTouchableOpacity
            onPress={onPress}
            {...rest}
            style={[styles.container, rest.style]}
        >
            <PWView style={styles.iconContainer}>{logoIcon}</PWView>
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

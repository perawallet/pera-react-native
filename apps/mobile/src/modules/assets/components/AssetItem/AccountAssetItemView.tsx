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

import { Decimal } from 'decimal.js'
import { AssetIcon } from '../AssetIcon'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import {
    PWIcon,
    PWIconSize,
    PWSkeleton,
    PWText,
    PWView,
    PWViewProps,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import {
    ALGO_ASSET_ID,
    isCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { CollectibleListItem } from '@modules/accounts/components/CollectibleListItem'
import { logger } from '@perawallet/wallet-core-shared'

export type AccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    usdPrice?: Decimal
    iconSize?: PWIconSize
} & PWViewProps

export const AccountAssetItemView = ({
    accountBalance,
    usdPrice,
    iconSize,
    ...rest
}: AccountAssetItemViewProps) => {
    const styles = useStyles()

    // Use pre-fetched asset data when available to avoid N+1 queries.
    // Falls back to individual fetch for callers that don't populate accountBalance.asset.
    const assetIds = useMemo(
        () => (accountBalance.asset ? [] : [accountBalance.assetId]),
        [accountBalance.asset, accountBalance.assetId],
    )
    const { data: fetchedAssets } = useAssetsQuery(assetIds)

    const asset = useMemo(() => {
        return (
            accountBalance.asset ?? fetchedAssets?.get(accountBalance.assetId)
        )
    }, [accountBalance.asset, fetchedAssets, accountBalance.assetId])

    const isAlgo = useMemo(
        () => asset?.assetId === ALGO_ASSET_ID,
        [asset?.assetId],
    )

    const verificationIconName = useMemo(() => {
        if (isAlgo) {
            return 'assets/trusted' as const
        }
        const tier = asset?.peraMetadata?.verificationTier
        return tier ? getVerificationIcon(tier) : null
    }, [asset, isAlgo])

    if (asset && isCollectible(asset)) {
        return (
            <CollectibleListItem
                asset={asset}
                amount={accountBalance.amount}
                onPress={() => {}}
            />
        )
    }

    if (!asset?.unitName) {
        return (
            <PWView style={[styles.container, rest.style]}>
                <PWSkeleton
                    height={40}
                    width={40}
                    circle
                />
                <PWView style={styles.dataContainer}>
                    <PWSkeleton height={16} />
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AssetIcon
                asset={asset}
                size={iconSize ?? 'lg'}
            />
            <PWView style={styles.dataContainer}>
                <PWView style={styles.unitContainer}>
                    <PWView style={styles.row}>
                        <PWText
                            style={styles.primaryUnit}
                            numberOfLines={1}
                        >
                            {isAlgo ? 'Algo' : asset.name}
                        </PWText>
                        {verificationIconName ? (
                            <PWIcon
                                name={verificationIconName}
                                size='xs'
                            />
                        ) : null}
                    </PWView>
                    <CopyableText copyValue={String(asset.assetId)}>
                        <PWText
                            style={styles.secondaryUnit}
                            numberOfLines={1}
                        >
                            {asset.unitName}
                            {asset.assetId !== ALGO_ASSET_ID &&
                                ` - ${asset.assetId}`}
                        </PWText>
                    </CopyableText>
                </PWView>
                <PWView style={styles.amountContainer}>
                    <CurrencyDisplay
                        currency={asset.unitName}
                        value={accountBalance.amount}
                        precision={asset.decimals}
                        minPrecision={2}
                        showSymbol
                        style={styles.primaryAmount}
                    />
                    <PreferredCurrencyDisplay
                        sourceAmount={accountBalance.amount}
                        sourceAssetId={accountBalance.assetId}
                        usdPrice={usdPrice}
                        precision={2}
                        minPrecision={2}
                        showSymbol
                        style={styles.secondaryAmount}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}

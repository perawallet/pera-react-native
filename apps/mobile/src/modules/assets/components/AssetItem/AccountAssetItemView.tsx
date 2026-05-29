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
    PWTouchableOpacity,
    PWTouchableOpacityProps,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import {
    ALGO_ASSET_ID,
    isCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { CollectibleListItem } from '../CollectibleListItem'

export type AccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    usdPrice?: Decimal
    iconSize?: PWIconSize
    skipFetch?: boolean
} & PWTouchableOpacityProps

export const AccountAssetItemView = ({
    accountBalance,
    usdPrice,
    iconSize,
    skipFetch = false,
    onPress,
    ...rest
}: AccountAssetItemViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    // Use pre-fetched asset data when available to avoid N+1 queries.
    // Falls back to individual fetch for callers that don't populate
    // accountBalance.asset. The main asset list passes skipFetch so all
    // rows share a single empty-array query and don't create a separate
    // RQ observer per row, which would saturate the JS thread on large
    // watch accounts.
    const assetIds = useMemo(
        () =>
            skipFetch || accountBalance.asset ? [] : [accountBalance.assetId],
        [skipFetch, accountBalance.asset, accountBalance.assetId],
    )
    const { data: fetchedAssets } = useAssetsQuery(assetIds)

    const asset = useMemo(() => {
        return (
            fetchedAssets?.get(accountBalance.assetId) ?? accountBalance.asset
        )
    }, [accountBalance.asset, fetchedAssets, accountBalance.assetId])

    const isAlgo = useMemo(
        () => asset?.assetId === ALGO_ASSET_ID,
        [asset?.assetId],
    )

    const isSuspicious = useMemo(() => {
        const tier = asset?.peraMetadata?.verificationTier
        return tier === 'suspicious'
    }, [asset?.peraMetadata?.verificationTier])

    const verificationIconName = useMemo(() => {
        if (isAlgo) {
            return 'assets/trusted' as const
        }
        const tier = asset?.peraMetadata?.verificationTier
        return tier ? getVerificationIcon(tier) : null
    }, [asset, isAlgo])

    const isFavorited = asset?.peraMetadata?.isFavorited ?? false
    const isDeleted = asset?.peraMetadata?.isDeleted === true

    const item = useMemo(() => {
        if (asset && isCollectible(asset)) {
            return {
                assetId: accountBalance.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount: accountBalance.amount,
            }
        }
        return null
    }, [asset, accountBalance])

    if (item) {
        return (
            <CollectibleListItem
                item={item}
                onPress={onPress}
            />
        )
    }

    if (!asset) {
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

    const displayName = isAlgo
        ? 'Algo'
        : asset.name || `Asset #${asset.assetId}`
    const secondaryText =
        asset.assetId === ALGO_ASSET_ID
            ? asset.unitName
            : asset.unitName
              ? `${asset.unitName} - ${asset.assetId}`
              : asset.assetId

    return (
        <PWTouchableOpacity
            activeOpacity={onPress ? undefined : 1}
            onPress={onPress}
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
                            style={
                                isSuspicious
                                    ? styles.suspiciousName
                                    : styles.primaryUnit
                            }
                            ellipsizeMode='middle'
                            numberOfLines={1}
                        >
                            {displayName}
                        </PWText>
                        {isFavorited ? (
                            <PWIcon
                                name='star-filled'
                                size='xs'
                                variant='favorite'
                                testID='favorite-star-icon'
                            />
                        ) : null}
                        {verificationIconName ? (
                            <PWIcon
                                name={verificationIconName}
                                size='xs'
                            />
                        ) : null}
                    </PWView>
                    {isDeleted ? (
                        <PWText
                            style={styles.deletedLabel}
                            numberOfLines={1}
                        >
                            {t('asset.deleted_label')}
                        </PWText>
                    ) : (
                        <CopyableText copyValue={String(asset.assetId)}>
                            <PWText
                                style={styles.secondaryUnit}
                                numberOfLines={1}
                            >
                                {secondaryText}
                            </PWText>
                        </CopyableText>
                    )}
                </PWView>
                <PWView style={styles.amountContainer}>
                    <CurrencyDisplay
                        currency={asset.unitName ?? ''}
                        value={accountBalance.amount}
                        precision={asset.decimals}
                        minPrecision={2}
                        showSymbol
                        style={styles.primaryAmount}
                        numberOfLines={1}
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
        </PWTouchableOpacity>
    )
}

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

import { PWBadge, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-asa-inbox'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { useStyles } from './styles'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { AssetIcon, AssetNameBadge } from '@modules/assets/components'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import {
    useSingleAssetDetailsQuery,
    toWholeUnits,
} from '@perawallet/wallet-core-assets'
import { useMemo } from 'react'

export type AssetTransferRequestItemProps = {
    item: Arc59AssetRequest
    onPress: () => void
}

export const AssetTransferRequestItem = ({
    item,
    onPress,
}: AssetTransferRequestItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { asset, senders, totalAmount, usdValue } = item
    const { data: fullAsset } = useSingleAssetDetailsQuery(asset.assetId)
    const resolvedAsset = fullAsset ?? asset

    const firstSender = senders.results[0]
    const remainingCount = senders.count - 1
    const { displayName: senderDisplayName } = useResolvedAddress(
        firstSender?.sender.address ?? '',
        { enabled: !!firstSender?.sender.address && !firstSender?.sender.name },
    )

    const amount = useMemo(
        () => toWholeUnits(totalAmount, asset),
        [totalAmount, asset],
    )

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.iconContainer}>
                <AssetIcon
                    asset={resolvedAsset}
                    size='xl'
                />
            </PWView>
            <PWView style={styles.contentContainer}>
                <PWView style={styles.topRow}>
                    <AssetNameBadge
                        name={asset.name ?? ''}
                        verificationTier={asset.peraMetadata?.verificationTier}
                        textStyle={styles.nameText}
                    />
                    <CurrencyDisplay
                        value={amount}
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals}
                        minPrecision={DEFAULT_PRECISION}
                        variant='h4'
                    />
                </PWView>
                <PWView style={styles.bottomRow}>
                    <PWView style={styles.sendersRow}>
                        {firstSender && (
                            <PWBadge
                                variant='secondary'
                                value={
                                    firstSender.sender.name ?? senderDisplayName
                                }
                            />
                        )}
                        {remainingCount > 0 && (
                            <PWBadge
                                variant='secondary'
                                value={t('messages.claim.sender_count_more', {
                                    count: remainingCount,
                                })}
                            />
                        )}
                    </PWView>
                    <PreferredCurrencyDisplay
                        sourceAmount={amount}
                        sourceAssetId={asset?.assetId}
                        precision={DEFAULT_PRECISION}
                        showSymbol
                        usdPrice={usdValue ?? undefined}
                    />
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}

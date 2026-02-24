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

import {
    PWBadge,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-blockchain'
import {
    DEFAULT_PRECISION,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { AssetTitle } from '@modules/assets/components'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'

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
    const { asset, senders, totalAmount } = item

    const firstSender = senders.results[0]
    const remainingCount = senders.count - 1

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.iconContainer}>
                <PWIcon
                    name='inbox'
                    variant='secondary'
                    size='lg'
                />
            </PWView>
            <PWView style={styles.contentContainer}>
                <PWView style={styles.topRow}>
                    <AssetTitle asset={asset} />
                    <CurrencyDisplay
                        value={Decimal(totalAmount)}
                        currency={asset?.unitName ?? ''}
                        precision={asset?.decimals}
                        minPrecision={DEFAULT_PRECISION}
                    />
                </PWView>
                <PWView style={styles.bottomRow}>
                    <PWView style={styles.sendersRow}>
                        {firstSender && (
                            <PWBadge
                                variant='secondary'
                                value={
                                    firstSender.sender.name ??
                                    truncateAlgorandAddress(
                                        firstSender.sender.address,
                                    )
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
                        sourceAmount={Decimal(totalAmount)}
                        sourceAssetId={asset?.assetId}
                        precision={DEFAULT_PRECISION}
                        showSymbol
                    />
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}

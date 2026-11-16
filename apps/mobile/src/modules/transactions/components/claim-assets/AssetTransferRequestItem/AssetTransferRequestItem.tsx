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

import { PWBadge, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { useStyles } from './styles'
import { useAssetTransferRequestItem } from './useAssetTransferRequestItem'
import { AssetAmount } from '@components/AssetAmount'
import { AssetIcon } from '@components/AssetIcon'
import { AssetNameBadge } from '@modules/assets'
import { PreferredAmount } from '@components/PreferredAmount'
import { ChainNotice } from '@components/ChainNotice'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

export type AssetTransferRequestItemProps = {
    item: AssetInboxRequest
    scope: ChainScope
    onPress: () => void
}

export const AssetTransferRequestItem = ({
    item,
    scope,
    onPress,
}: AssetTransferRequestItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { asset, senders, usdValue } = item
    const { resolvedAsset, senderDisplayName, amount, imitatedCurrency } =
        useAssetTransferRequestItem(item, scope)

    const firstSender = senders.results[0]
    const remainingCount = senders.count - 1

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
        >
            <PWView style={styles.iconContainer}>
                <AssetIcon
                    chainId={scope.chainId}
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
                    <AssetAmount
                        chainId={scope.chainId}
                        value={amount}
                        asset={asset}
                        density='compact'
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
                    <PreferredAmount
                        sourceAmount={amount}
                        sourceAssetId={asset?.assetId}
                        showSymbol
                        usdPrice={usdValue ?? undefined}
                    />
                </PWView>
                {imitatedCurrency !== null && (
                    <ChainNotice
                        kind='warning'
                        titleKey='asset.imitated_currency.marker'
                        params={{ code: imitatedCurrency }}
                        testID={`asset_inbox_request_imitated_currency_${asset.assetId}`}
                    />
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}

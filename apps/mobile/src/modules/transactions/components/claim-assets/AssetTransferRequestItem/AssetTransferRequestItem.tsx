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
import { PWText } from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import { useLanguage } from '@hooks/useLanguage'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { InboxAssetRow } from '../InboxAssetRow'
import { useStyles } from './styles'
import { useAssetTransferRequestItem } from './useAssetTransferRequestItem'

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
    const { senders, usdValue } = item
    const { resolvedAsset, senderDisplayName, amount, imitatedCurrency } =
        useAssetTransferRequestItem(item, scope)

    const firstSender = senders.results[0]
    const sender = firstSender?.sender.name ?? senderDisplayName

    return (
        <InboxAssetRow
            asset={resolvedAsset}
            scope={scope}
            amount={amount}
            usdPrice={usdValue}
            onPress={onPress}
            footer={
                <>
                    {firstSender ? (
                        <PWText
                            variant='caption'
                            style={styles.sender}
                            numberOfLines={1}
                        >
                            {senders.count > 1
                                ? t('messages.claim.from_senders', {
                                      sender,
                                      count: senders.count - 1,
                                  })
                                : t('messages.claim.from_sender', { sender })}
                        </PWText>
                    ) : null}
                    {imitatedCurrency !== null && (
                        <ChainNotice
                            kind='warning'
                            titleKey='asset.imitated_currency.marker'
                            params={{ code: imitatedCurrency }}
                            testID={`asset_inbox_request_imitated_currency_${resolvedAsset.assetId}`}
                        />
                    )}
                </>
            }
        />
    )
}

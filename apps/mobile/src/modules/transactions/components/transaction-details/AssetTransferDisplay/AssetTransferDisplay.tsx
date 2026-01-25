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
import {
    TransactionIcon,
    type TransactionIconType,
} from '@modules/transactions/components/TransactionIcon'
import {
    encodeAlgorandAddress,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type AssetTransferDisplayProps = {
    transaction: PeraTransaction
}

type AssetTransferType = 'transfer' | 'opt-in' | 'opt-out' | 'clawback'

const getAssetTransferType = (tx: PeraTransaction): AssetTransferType => {
    const assetTransfer = tx.assetTransfer
    if (!assetTransfer) {
        return 'transfer'
    }

    const senderAddress = encodeAlgorandAddress(tx.sender.publicKey)
    const receiverAddress = encodeAlgorandAddress(
        assetTransfer.receiver.publicKey,
    )
    const isToSelf = senderAddress === receiverAddress
    const isZeroAmount = assetTransfer.amount === BigInt(0)
    const hasCloseRemainder = assetTransfer.closeRemainderTo !== undefined
    const hasAssetSender = assetTransfer.assetSender !== undefined

    if (hasAssetSender) {
        return 'clawback'
    }

    if (isToSelf && isZeroAmount && !hasCloseRemainder) {
        return 'opt-in'
    }

    if (hasCloseRemainder) {
        return 'opt-out'
    }

    return 'transfer'
}

const getIconType = (transferType: AssetTransferType): TransactionIconType => {
    switch (transferType) {
        case 'opt-in':
            return 'opt-in'
        case 'opt-out':
            return 'opt-out'
        case 'clawback':
            return 'clawback'
        default:
            return 'asset-transfer'
    }
}

export const AssetTransferDisplay = ({
    transaction,
}: AssetTransferDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const assetTransfer = transaction.assetTransfer
    if (!assetTransfer) {
        return null
    }

    const transferType = getAssetTransferType(transaction)
    const receiverAddress = encodeAlgorandAddress(
        assetTransfer.receiver.publicKey,
    )
    const assetId = assetTransfer.assetId.toString()
    const amount = assetTransfer.amount.toString()

    const getTitleKey = () => {
        switch (transferType) {
            case 'opt-in':
                return 'signing.tx_display.asset_transfer.opt_in_title'
            case 'opt-out':
                return 'signing.tx_display.asset_transfer.opt_out_title'
            case 'clawback':
                return 'signing.tx_display.asset_transfer.clawback_title'
            default:
                return 'signing.tx_display.asset_transfer.title'
        }
    }

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type={getIconType(transferType)}
                size='large'
            />
            <PWText variant='h4'>{t(getTitleKey())}</PWText>

            <PWView style={styles.detailsContainer}>
                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.common.asset_id')}
                    </PWText>
                    <PWText style={styles.value}>{assetId}</PWText>
                </PWView>

                {transferType !== 'opt-in' && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.common.amount')}
                        </PWText>
                        <PWText style={styles.value}>{amount}</PWText>
                    </PWView>
                )}

                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.common.to')}
                    </PWText>
                    <PWText style={styles.value}>
                        {truncateAlgorandAddress(receiverAddress)}
                    </PWText>
                </PWView>

                {assetTransfer.assetSender && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t(
                                'signing.tx_display.asset_transfer.clawback_from',
                            )}
                        </PWText>
                        <PWText style={styles.value}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetTransfer.assetSender.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}

                {assetTransfer.closeRemainderTo && (
                    <PWView style={styles.warningContainer}>
                        <PWText style={styles.warningText}>
                            {t(
                                'signing.tx_display.asset_transfer.close_warning',
                            )}
                        </PWText>
                        <PWText style={styles.warningAddress}>
                            {truncateAlgorandAddress(
                                encodeAlgorandAddress(
                                    assetTransfer.closeRemainderTo.publicKey,
                                ),
                            )}
                        </PWText>
                    </PWView>
                )}
            </PWView>
        </PWView>
    )
}

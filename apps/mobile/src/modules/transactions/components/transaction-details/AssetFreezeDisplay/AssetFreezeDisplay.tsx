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
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    encodeAlgorandAddress,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type AssetFreezeDisplayProps = {
    transaction: PeraTransaction
}

export const AssetFreezeDisplay = ({
    transaction,
}: AssetFreezeDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const assetFreeze = transaction.assetFreeze
    if (!assetFreeze) {
        return null
    }

    const isFreezing = assetFreeze.frozen
    const targetAddress = encodeAlgorandAddress(
        assetFreeze.freezeTarget.publicKey,
    )
    const assetId = assetFreeze.assetId.toString()

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type='asset-freeze'
                size='large'
            />
            <PWText variant='h4'>
                {isFreezing
                    ? t('signing.tx_display.asset_freeze.freeze_title')
                    : t('signing.tx_display.asset_freeze.unfreeze_title')}
            </PWText>

            <PWView style={styles.detailsContainer}>
                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.common.asset_id')}
                    </PWText>
                    <PWText style={styles.value}>{assetId}</PWText>
                </PWView>

                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.asset_freeze.target')}
                    </PWText>
                    <PWText style={styles.value}>
                        {truncateAlgorandAddress(targetAddress)}
                    </PWText>
                </PWView>

                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.asset_freeze.status')}
                    </PWText>
                    <PWText
                        style={[
                            styles.value,
                            isFreezing
                                ? styles.frozenStatus
                                : styles.unfrozenStatus,
                        ]}
                    >
                        {isFreezing
                            ? t('signing.tx_display.asset_freeze.frozen')
                            : t('signing.tx_display.asset_freeze.unfrozen')}
                    </PWText>
                </PWView>
            </PWView>

            {isFreezing && (
                <PWView style={styles.warningContainer}>
                    <PWText style={styles.warningText}>
                        {t('signing.tx_display.asset_freeze.freeze_warning')}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}

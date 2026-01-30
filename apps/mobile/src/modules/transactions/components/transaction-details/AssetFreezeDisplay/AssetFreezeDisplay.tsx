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

import { PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    microAlgosToAlgos,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'

export type AssetFreezeDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

export const AssetFreezeDisplay = ({
    transaction,
    isInnerTransaction = false,
}: AssetFreezeDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const assetFreeze = transaction.assetFreezeTransaction
    if (!assetFreeze) {
        return null
    }

    const isFreezing = assetFreeze.newFreezeStatus
    const targetAddress = assetFreeze.address
    const assetId = assetFreeze.assetId.toString()
    const showWarnings = !transaction?.id

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <KeyValueRow title={t('transactions.common.asset_id')}>
                    <PWText>{assetId}</PWText>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.asset_freeze.target')}>
                    <PWView style={styles.detailRow}>
                        <AddressDisplay address={targetAddress} />
                    </PWView>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.asset_freeze.status')}>
                    <PWText
                        style={
                            isFreezing
                                ? styles.frozenStatus
                                : styles.unfrozenStatus
                        }
                    >
                        {isFreezing
                            ? t('transactions.asset_freeze.frozen')
                            : t('transactions.asset_freeze.unfrozen')}
                    </PWText>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.fee')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={6}
                        minPrecision={2}
                        value={Decimal(
                            microAlgosToAlgos(transaction.fee ?? 0n),
                        )}
                        showSymbol
                    />
                </KeyValueRow>

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}

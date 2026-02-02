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
import {
    KeyRegType,
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
import { AddressDisplay } from '@components/AddressDisplay'
import { useMemo } from 'react'

export type KeyRegistrationDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

const getKeyRegType = (tx: PeraDisplayableTransaction): KeyRegType => {
    return tx.keyregTransaction?.nonParticipation ? 'offline' : 'online'
}

export const KeyRegistrationDisplay = ({
    transaction,
    isInnerTransaction = false,
}: KeyRegistrationDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const keyRegType = useMemo(() => getKeyRegType(transaction), [transaction])
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const keyReg = transaction.keyregTransaction

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
                <KeyValueRow title={t('transactions.key_reg.status')}>
                    <PWText>{t(`transactions.key_reg.${keyRegType}`)}</PWText>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.from')}>
                    <AddressDisplay address={transaction.sender} />
                </KeyValueRow>

                {keyRegType === 'online' && keyReg && (
                    <>
                        {keyReg.voteFirstValid !== undefined &&
                            keyReg.voteLastValid !== undefined && (
                                <KeyValueRow
                                    title={t(
                                        'transactions.key_reg.valid_rounds',
                                    )}
                                >
                                    <PWText>
                                        {keyReg.voteFirstValid.toString()} -{' '}
                                        {keyReg.voteLastValid.toString()}
                                    </PWText>
                                </KeyValueRow>
                            )}

                        {keyReg.voteKeyDilution !== undefined && (
                            <KeyValueRow
                                title={t('transactions.key_reg.key_dilution')}
                            >
                                <PWText>
                                    {keyReg.voteKeyDilution.toString()}
                                </PWText>
                            </KeyValueRow>
                        )}

                        {keyReg.voteParticipationKey !== undefined && (
                            <KeyValueRow
                                title={t(
                                    'transactions.key_reg.participation_key',
                                )}
                            >
                                <PWText>
                                    {keyReg.voteParticipationKey.toString()}
                                </PWText>
                            </KeyValueRow>
                        )}

                        {keyReg.selectionParticipationKey !== undefined && (
                            <KeyValueRow
                                title={t('transactions.key_reg.selection_key')}
                            >
                                <PWText>
                                    {keyReg.selectionParticipationKey.toString()}
                                </PWText>
                            </KeyValueRow>
                        )}
                    </>
                )}

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

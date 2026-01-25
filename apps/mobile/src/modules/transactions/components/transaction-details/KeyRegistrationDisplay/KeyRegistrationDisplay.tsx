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
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type KeyRegistrationDisplayProps = {
    transaction: PeraTransaction
}

type KeyRegType = 'online' | 'offline' | 'nonparticipating'

const getKeyRegType = (tx: PeraTransaction): KeyRegType => {
    const keyReg = tx.keyRegistration

    if (keyReg?.nonParticipation) {
        return 'nonparticipating'
    }

    if (keyReg?.voteKey && keyReg?.selectionKey) {
        return 'online'
    }

    return 'offline'
}

export const KeyRegistrationDisplay = ({
    transaction,
}: KeyRegistrationDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const keyRegType = getKeyRegType(transaction)
    const keyReg = transaction.keyRegistration

    const getTitleKey = () => {
        switch (keyRegType) {
            case 'online':
                return 'signing.tx_display.key_reg.online_title'
            case 'nonparticipating':
                return 'signing.tx_display.key_reg.nonparticipating_title'
            default:
                return 'signing.tx_display.key_reg.offline_title'
        }
    }

    const getDescriptionKey = () => {
        switch (keyRegType) {
            case 'online':
                return 'signing.tx_display.key_reg.online_description'
            case 'nonparticipating':
                return 'signing.tx_display.key_reg.nonparticipating_description'
            default:
                return 'signing.tx_display.key_reg.offline_description'
        }
    }

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type='key-registration'
                size='large'
            />
            <PWText variant='h4'>{t(getTitleKey())}</PWText>

            <PWView style={styles.descriptionContainer}>
                <PWText style={styles.description}>
                    {t(getDescriptionKey())}
                </PWText>
            </PWView>

            {keyRegType === 'online' && keyReg && (
                <PWView style={styles.detailsContainer}>
                    {keyReg.voteFirst !== undefined &&
                        keyReg.voteLast !== undefined && (
                            <PWView style={styles.detailRow}>
                                <PWText style={styles.label}>
                                    {t(
                                        'signing.tx_display.key_reg.valid_rounds',
                                    )}
                                </PWText>
                                <PWText style={styles.value}>
                                    {keyReg.voteFirst.toString()} -{' '}
                                    {keyReg.voteLast.toString()}
                                </PWText>
                            </PWView>
                        )}

                    {keyReg.voteKeyDilution !== undefined && (
                        <PWView style={styles.detailRow}>
                            <PWText style={styles.label}>
                                {t('signing.tx_display.key_reg.key_dilution')}
                            </PWText>
                            <PWText style={styles.value}>
                                {keyReg.voteKeyDilution.toString()}
                            </PWText>
                        </PWView>
                    )}
                </PWView>
            )}

            {keyRegType === 'nonparticipating' && (
                <PWView style={styles.warningContainer}>
                    <PWText style={styles.warningText}>
                        {t(
                            'signing.tx_display.key_reg.nonparticipating_warning',
                        )}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}

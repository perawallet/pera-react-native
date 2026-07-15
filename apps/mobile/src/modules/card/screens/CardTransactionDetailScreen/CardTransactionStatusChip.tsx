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

import { TransactionStatus } from '@perawallet/wallet-core-card'
import { PWChip, type PWChipProps } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type CardTransactionStatusChipProps = {
    status: TransactionStatus
}

type StatusMeta = {
    titleKey: string
    variant: PWChipProps['variant']
}

const statusMeta = (status: TransactionStatus): StatusMeta => {
    switch (status) {
        case TransactionStatus.Confirmed: {
            return {
                titleKey: 'peraCard.transactions.status_completed',
                variant: 'positive',
            }
        }
        case TransactionStatus.Pending: {
            return {
                titleKey: 'peraCard.transactions.status_pending',
                variant: 'secondary',
            }
        }
        case TransactionStatus.Declined: {
            return {
                titleKey: 'peraCard.transactions.status_declined',
                variant: 'negative',
            }
        }
        case TransactionStatus.Reverted: {
            return {
                titleKey: 'peraCard.transactions.status_reverted',
                variant: 'negative',
            }
        }
    }
}

export const CardTransactionStatusChip = ({
    status,
}: CardTransactionStatusChipProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { titleKey, variant } = statusMeta(status)

    return (
        <PWChip
            title={t(titleKey)}
            variant={variant}
            forceUppercase={false}
            textVariant='footnoteMedium'
            style={styles.statusChip}
        />
    )
}

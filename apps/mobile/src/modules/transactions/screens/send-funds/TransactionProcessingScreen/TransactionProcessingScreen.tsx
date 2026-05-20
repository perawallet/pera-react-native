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

import LottieView from 'lottie-react-native'

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'
import { LedgerAwaitingApprovalContent } from '@modules/signing/components/LedgerAwaitingApprovalContent'
import { LedgerErrorContent } from '@modules/signing/components/LedgerErrorContent'
import { useStyles } from './styles'
import { useTransactionProcessingScreen } from './useTransactionProcessingScreen'

export const TransactionProcessingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const { view, ledger } = useTransactionProcessingScreen()

    if (view === 'ledger-awaiting') {
        return (
            <LedgerAwaitingApprovalContent
                deviceName={ledger.deviceName}
                currentTx={ledger.currentTx}
                totalTxs={ledger.totalTxs}
                onCancel={ledger.onCancel}
            />
        )
    }

    if (view === 'ledger-error' && ledger.error) {
        return (
            <LedgerErrorContent
                error={ledger.error}
                onRetry={ledger.onRetry}
                onClose={ledger.onCancel}
                onOpenTroubleshooting={ledger.onOpenTroubleshooting}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.spinnerCircle}>
                <LottieView
                    autoPlay
                    loop
                    source={peraTransactionLoading}
                    style={styles.animation}
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('send_funds.processing.title')}
            </PWText>
            <PWText style={styles.subtitle}>
                {t('send_funds.processing.subtitle')}
            </PWText>
        </PWView>
    )
}

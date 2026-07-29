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

import { PWDivider, PWScreen, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionSummaryHeader } from '@modules/signing/components/TransactionSummaryHeader'
import { FeeDisplay } from '@modules/signing/components/FeeDisplay'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import {
    useSigningPipeline,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { type Optional } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { SigningActionButtons } from '@modules/signing/components/SigningActionButtons'
import { SigningAccountDisplay } from '@modules/signing/components/SigningAccountDisplay/SigningAccountDisplay'

export const SingleTransactionScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const pipeline = useSigningPipeline()
    const request = pipeline.currentRequest as Optional<TransactionSignRequest>
    const { allTransactions } = pipeline

    const transaction = allTransactions[0]

    // After signing completes, the actor clears the request from the store
    // before the bottom sheet finishes animating closed. Suppressing the
    // empty state when there's no request avoids a flash of "Invalid
    // Transaction" during that teardown window.
    if (!request) {
        return null
    }

    if (!transaction) {
        return (
            <EmptyView
                title={t('signing.transaction_view.invalid_title')}
                body={t('signing.transaction_view.invalid_body')}
            />
        )
    }

    return (
        <PWScreen
            footer={<SigningActionButtons />}
            testID='signing_transaction_review'
        >
            <PWView style={styles.contentContainer}>
                <TransactionSummaryHeader
                    transaction={transaction}
                    metadata={request?.sourceMetadata}
                    verifiedOrigin={request?.verifiedOrigin}
                />

                <SigningWarnings />

                <PWDivider
                    color={theme.colors.layerGray}
                    style={styles.paddedDivider}
                />

                <SigningAccountDisplay transaction={transaction} />

                <FeeDisplay transaction={transaction} />
            </PWView>
        </PWScreen>
    )
}

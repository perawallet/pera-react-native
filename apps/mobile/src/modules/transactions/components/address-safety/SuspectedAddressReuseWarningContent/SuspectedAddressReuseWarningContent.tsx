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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import { PWView } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { ComparedAddress, useImitationComparison } from '../ComparedAddress'
import { useStyles } from './styles'

export type SuspectedAddressReuseDecision = 'continue'

export type SuspectedAddressReuseWarningContentProps = {
    suspectedPoisoning: SuspectedPoisoning
    scope: ChainScope
}

export const SuspectedAddressReuseWarningContent = ({
    suspectedPoisoning,
    scope,
}: SuspectedAddressReuseWarningContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { senderSegments, imitatedSegments, imitatedLabel } =
        useImitationComparison({ suspectedPoisoning, scope })

    return (
        <ConfirmActionContent<SuspectedAddressReuseDecision>
            icon='warning'
            iconVariant='error'
            title={t('transactions.suspected_poisoning.reuse_title')}
            message={t('transactions.suspected_poisoning.reuse_body')}
            confirmLabel={t('transactions.suspected_poisoning.reuse_confirm')}
            cancelLabel={t('transactions.suspected_poisoning.reuse_cancel')}
            confirmValue='continue'
            confirmVariant='destructive'
            testID='suspected_address_reuse_warning'
            confirmTestID='suspected_address_reuse_warning_continue'
            cancelTestID='suspected_address_reuse_warning_cancel'
        >
            <PWView style={styles.body}>
                <ComparedAddress
                    label={t('transactions.suspected_poisoning.sender_label')}
                    segments={senderSegments}
                    testID='suspected_address_reuse_sender_address'
                />
                <ComparedAddress
                    label={imitatedLabel}
                    segments={imitatedSegments}
                    testID='suspected_address_reuse_imitated_address'
                />
            </PWView>
        </ConfirmActionContent>
    )
}

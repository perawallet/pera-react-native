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
import { PWRoundIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ComparedAddress, useImitationComparison } from '../ComparedAddress'
import { useStyles } from './styles'

export type SuspectedPoisoningNoticeProps = {
    suspectedPoisoning: SuspectedPoisoning
    scope: ChainScope
    testID?: string
}

export const SuspectedPoisoningNotice = ({
    suspectedPoisoning,
    scope,
    testID = 'suspected_poisoning_notice',
}: SuspectedPoisoningNoticeProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { senderSegments, imitatedSegments, imitatedLabel } =
        useImitationComparison({ suspectedPoisoning, scope })

    return (
        <PWView
            style={styles.warning}
            testID={testID}
        >
            <PWView style={styles.header}>
                <PWRoundIcon
                    icon='info'
                    size='md'
                    variant='error'
                />
                <PWText
                    variant='bodySemibold'
                    style={styles.title}
                >
                    {t('transactions.suspected_poisoning.title')}
                </PWText>
            </PWView>
            <PWText style={styles.body}>
                {t('transactions.suspected_poisoning.body')}
            </PWText>
            <ComparedAddress
                label={t('transactions.suspected_poisoning.sender_label')}
                segments={senderSegments}
                testID='suspected_poisoning_sender_address'
            />
            <ComparedAddress
                label={imitatedLabel}
                segments={imitatedSegments}
                testID='suspected_poisoning_imitated_address'
            />
        </PWView>
    )
}

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

import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWText, PWView } from '@components/core'
import { TransactionIcon } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import {
    SourceMetadataBadge,
    useReviewNetworkLabel,
    useSpendApprovalTitle,
} from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

type EthereumReviewHeaderProps = {
    presentation: EthereumTransactionPresentation
    source?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

/** Who asked, what for and on which network: the part of the review that stays on screen. */
export const EthereumReviewHeader = ({
    presentation,
    source,
    verifiedOrigin,
}: EthereumReviewHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const networkLabel = useReviewNetworkLabel()
    const { titleKey, iconName, standardCall } = presentation
    const approvalTitle = useSpendApprovalTitle(
        standardCall?.kind === 'token-approval'
            ? standardCall.spendApproval
            : undefined,
        presentation.scope,
    )

    return (
        <PWView
            style={styles.header}
            testID='ethereum_review_header'
        >
            {!!source && (
                <SourceMetadataBadge
                    metadata={source}
                    verifiedOrigin={verifiedOrigin}
                />
            )}

            <PWView style={styles.headerRow}>
                <TransactionIcon
                    name={iconName}
                    size='md'
                />
                <PWView style={styles.headerText}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {approvalTitle ?? t(titleKey)}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.caption}
                        testID='ethereum_review_network'
                    >
                        {networkLabel}
                    </PWText>
                </PWView>
            </PWView>
        </PWView>
    )
}

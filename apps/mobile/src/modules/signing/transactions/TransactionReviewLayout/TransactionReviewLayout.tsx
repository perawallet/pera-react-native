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

import type { ReactNode } from 'react'
import { useTheme } from '@rneui/themed'
import { PWDivider, PWScreen, PWView } from '@components/core'
import { RequestAddressWarning } from '@modules/signing/components/RequestAddressWarning'
import { RequestSiteWarning } from '@modules/signing/components/RequestSiteWarning'
import {
    ReviewWarningsBanner,
    type ReviewWarningItem,
} from '@modules/signing/components/ReviewWarningsBanner'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import { useStyles } from './styles'
import { useTransactionReviewLayout } from './useTransactionReviewLayout'

export type TransactionReviewLayoutProps = {
    /** Pinned above the scrolling body. */
    header?: ReactNode
    /** What the transaction is, first in the scrolling body. */
    hero?: ReactNode
    /** The review's own warnings, folded into one banner. */
    warnings?: readonly ReviewWarningItem[]
    /** What the transaction will do, ahead of every other section. */
    summary?: ReactNode
    participants: ReactNode
    /** The cost, in the scrolling body right after the participants. A chain passes this or `stickyFee`. */
    fee?: ReactNode
    /** The cost, pinned directly above `actions` so it is on screen beside Confirm. */
    stickyFee?: ReactNode
    /** What the transaction does in full, after the fee. */
    details?: ReactNode
    /** The screen's Confirm and Cancel. */
    actions: ReactNode
}

export const TransactionReviewLayout = ({
    header,
    hero,
    warnings,
    summary,
    participants,
    fee,
    stickyFee,
    details,
    actions,
}: TransactionReviewLayoutProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { warningItems } = useTransactionReviewLayout(warnings)

    return (
        <PWScreen
            header={header}
            footer={
                <PWView style={styles.footer}>
                    {stickyFee}
                    {actions}
                </PWView>
            }
            testID='signing_transaction_review'
        >
            <PWView style={styles.content}>
                {hero}

                <ReviewWarningsBanner items={warningItems} />

                <SigningWarnings />

                <RequestSiteWarning />

                <RequestAddressWarning />

                {summary}

                <PWDivider
                    color={theme.colors.layerGray}
                    style={styles.paddedDivider}
                />

                {participants}

                {fee}

                {details}
            </PWView>
        </PWScreen>
    )
}

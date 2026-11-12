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
import { PWScreen, PWView } from '@components/core'
import { RequestAddressWarning } from '@modules/signing/components/RequestAddressWarning'
import { RequestSiteWarning } from '@modules/signing/components/RequestSiteWarning'
import {
    ReviewWarningsBanner,
    type ReviewWarningItem,
} from '@modules/signing/components/ReviewWarningsBanner'
import {
    ReviewScrollHint,
    useReviewScrollHint,
} from '@modules/signing/components/ReviewScrollHint'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import { useStyles } from './styles'
import { useTransactionReviewLayout } from './useTransactionReviewLayout'

/**
 * One template for every transaction a chain reviews, slot by slot: who asked,
 * the action and its target, what changes, cautions, details, then a way into
 * the technical details. A chain fills the slots it has data for.
 */
export type TransactionReviewLayoutProps = {
    /** The requesting site; absent for a request the wallet started itself. */
    requester?: ReactNode
    /** What the transaction does and what it is aimed at. */
    action?: ReactNode
    /** What leaves and enters the wallet, or the permission it grants. */
    changes?: ReactNode
    /** The chain's cautions, one card each, most serious first. */
    warnings?: readonly ReviewWarningItem[]
    /** From, Network and Network fee. */
    details?: ReactNode
    /** Chain-specific facts after the details, such as a key registration's fields. */
    extra?: ReactNode
    /** The link into the technical details. */
    technicalDetails?: ReactNode
    /** The screen's Confirm and Cancel. */
    actions: ReactNode
}

export const TransactionReviewLayout = ({
    requester,
    action,
    changes,
    warnings,
    details,
    extra,
    technicalDetails,
    actions,
}: TransactionReviewLayoutProps) => {
    const styles = useStyles()
    const { warningItems } = useTransactionReviewLayout(warnings)
    const {
        scrollRef,
        isMoreBelow,
        handleScroll,
        handleBodyLayout,
        handleContentSizeChange,
        handleScrollToEnd,
    } = useReviewScrollHint()

    return (
        <PWScreen
            scrollRef={scrollRef}
            onScroll={handleScroll}
            onBodyLayout={handleBodyLayout}
            onContentSizeChange={handleContentSizeChange}
            footer={
                <PWView style={styles.footer}>
                    <ReviewScrollHint
                        isVisible={isMoreBelow}
                        onPress={handleScrollToEnd}
                    />
                    {actions}
                </PWView>
            }
            testID='signing_transaction_review'
        >
            <PWView style={styles.content}>
                {(!!requester || !!action) && (
                    <PWView style={styles.header}>
                        {requester}
                        {action}
                    </PWView>
                )}

                {changes}

                <ReviewWarningsBanner items={warningItems} />

                <SigningWarnings />

                <RequestSiteWarning />

                <RequestAddressWarning />

                {!!details && <PWView>{details}</PWView>}

                {extra}

                {technicalDetails}
            </PWView>
        </PWScreen>
    )
}

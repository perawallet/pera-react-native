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
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { TransactionDetailCard } from '../TransactionDetailCard'
import type { TransactionDetailSummary } from '../types'
import { TransactionDetailFactsCard } from './TransactionDetailFactsCard'
import { TransactionDetailHero } from './TransactionDetailHero'
import { TransactionDetailPartiesCard } from './TransactionDetailPartiesCard'
import { useStyles } from './styles'
import { useTransactionDetailLayout } from './useTransactionDetailLayout'

export type TransactionDetailLayoutProps = {
    summary: TransactionDetailSummary
    warnings?: ReactNode
    /** The chain's own cards, each wrapped in `TransactionDetailCard`. */
    chainSection?: ReactNode
    /** Rows below the explorer link in the links card, such as View JSON. */
    actions?: ReactNode
}

export const TransactionDetailLayout = ({
    summary,
    warnings,
    chainSection,
    actions,
}: TransactionDetailLayoutProps) => {
    const styles = useStyles()
    const { explorerLabel, handleOpenExplorer } = useTransactionDetailLayout(
        summary.scope,
        summary.transactionId,
    )

    return (
        <PWView style={styles.container}>
            <TransactionDetailHero summary={summary} />
            {warnings}
            <TransactionDetailFactsCard summary={summary} />
            <TransactionDetailPartiesCard summary={summary} />
            {chainSection}
            {(!!handleOpenExplorer || !!actions) && (
                <TransactionDetailCard testID='transaction_detail_links'>
                    {!!handleOpenExplorer && (
                        <PWTouchableOpacity
                            testID='transaction_detail_explorer'
                            style={styles.explorerRow}
                            onPress={handleOpenExplorer}
                            accessibilityRole='link'
                        >
                            <PWText
                                variant='bodyLarge'
                                style={styles.explorerLabel}
                            >
                                {explorerLabel}
                            </PWText>
                            <PWIcon
                                name='arrow-up-right'
                                variant='secondary'
                            />
                        </PWTouchableOpacity>
                    )}
                    {actions}
                </TransactionDetailCard>
            )}
        </PWView>
    )
}

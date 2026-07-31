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

import { PWDivider, PWText, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { SourceMetadataBadge } from '@modules/signing/components/SourceMetadataBadge'
import {
    BalanceImpactSummary,
    useBalanceImpactSummary,
} from '@modules/signing/components/BalanceImpactSummary'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type TransactionListHeaderProps = {
    itemCount: number
    sourceMetadata?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

export const TransactionListHeader = ({
    itemCount,
    sourceMetadata,
    verifiedOrigin,
}: TransactionListHeaderProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { hasImpact, isSimulating, simulationFailed } =
        useBalanceImpactSummary()

    // Hide the whole section (and its flanking divider) when no assets change
    // hands, so the layout doesn't show two dividers around an empty gap. A
    // failed simulation has no impact to show but does have a warning to render,
    // which would otherwise be suppressed — leaving the group with no values.
    const showBalanceImpact = hasImpact || isSimulating || simulationFailed

    return (
        <>
            <PWView style={styles.listHeader}>
                {!!sourceMetadata && (
                    <SourceMetadataBadge
                        metadata={sourceMetadata}
                        verifiedOrigin={verifiedOrigin}
                    />
                )}

                <TransactionIcon
                    type='group'
                    size='lg'
                />
                <PWText variant='h3'>
                    {t('signing.transactions.multiple_transactions_title')}
                </PWText>
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            {showBalanceImpact && (
                <>
                    <PWView style={styles.balanceImpactContainer}>
                        <BalanceImpactSummary />
                    </PWView>

                    <PWDivider color={theme.colors.layerGray} />
                </>
            )}

            <PWText style={styles.listSubheaderText}>
                {t('signing.transactions.transactions_count', {
                    count: itemCount,
                })}
            </PWText>
        </>
    )
}

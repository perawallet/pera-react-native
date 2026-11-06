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

import { PWText, PWView } from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import { useLanguage } from '@hooks/useLanguage'
import { BalanceImpactSection, PredictedFailureWarning } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumApprovalChangeRow } from './EthereumApprovalChangeRow'
import { useStyles } from './styles'
import { useEthereumSimulationSection } from './useEthereumSimulationSection'

type EthereumSimulationSectionProps = {
    presentation: EthereumTransactionPresentation
}

export const EthereumSimulationSection = ({
    presentation,
}: EthereumSimulationSectionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const state = useEthereumSimulationSection(presentation)

    switch (state.status) {
        case 'hidden': {
            return null
        }
        case 'loading': {
            return (
                <PWView
                    style={styles.container}
                    testID='ethereum_simulation_loading'
                >
                    <PWText
                        variant='caption'
                        style={styles.caption}
                    >
                        {t('signing.balance_impact.analyzing')}
                    </PWText>
                </PWView>
            )
        }
        case 'reverted': {
            return <PredictedFailureWarning reason={state.reason} />
        }
        case 'unavailable': {
            return (
                <ChainNotice
                    kind='warning'
                    titleKey='ethereum.simulation.unavailable'
                    testID='ethereum_simulation_unavailable'
                />
            )
        }
        case 'success': {
            const isEmpty =
                state.spend.length === 0 &&
                state.receive.length === 0 &&
                state.approvals.length === 0
            return (
                <PWView
                    style={styles.container}
                    testID='ethereum_simulation_changes'
                >
                    <PWText
                        variant='caption'
                        style={styles.sectionTitle}
                    >
                        {t('ethereum.simulation.title')}
                    </PWText>
                    {isEmpty && (
                        <PWText testID='ethereum_simulation_no_changes'>
                            {t('ethereum.simulation.no_changes')}
                        </PWText>
                    )}
                    <BalanceImpactSection
                        title={t('signing.balance_impact.spend_title')}
                        items={state.spend}
                    />
                    <BalanceImpactSection
                        title={t('signing.balance_impact.receive_title')}
                        items={state.receive}
                    />
                    {state.approvals.length > 0 && (
                        <PWView style={styles.approvals}>
                            <PWText
                                variant='caption'
                                style={styles.sectionTitle}
                            >
                                {t('ethereum.simulation.approvals_title')}
                            </PWText>
                            {state.approvals.map(change => (
                                <EthereumApprovalChangeRow
                                    key={change.key}
                                    change={change}
                                    scope={presentation.scope}
                                />
                            ))}
                        </PWView>
                    )}
                    <PWText
                        variant='caption'
                        style={styles.caption}
                    >
                        {t('ethereum.simulation.estimate_note')}
                    </PWText>
                </PWView>
            )
        }
    }
}

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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BalanceImpactRow } from './BalanceImpactRow'
import {
    useBalanceImpactSummary,
    type BalanceImpactItem,
} from './useBalanceImpactSummary'
import { useStyles } from './styles'

type SectionProps = {
    title: string
    items: BalanceImpactItem[]
}

const Section = ({ title, items }: SectionProps) => {
    const styles = useStyles()

    if (items.length === 0) {
        return null
    }

    return (
        <PWView style={styles.section}>
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {title}
            </PWText>
            {items.map(item => (
                <BalanceImpactRow
                    key={`${title}-${item.assetId}`}
                    item={item}
                />
            ))}
        </PWView>
    )
}

export const BalanceImpactSummary = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { receive, spend, hasImpact, isSimulating, simulationFailed } =
        useBalanceImpactSummary()

    // Simulation resolves the inner txns that carry the receive side. If it
    // failed, the impact is incomplete (spend may show, receive is unknown) —
    // show an honest message rather than a partial impact that reads complete.
    if (simulationFailed) {
        return (
            <PWView
                style={styles.container}
                testID='balance-impact-summary'
            >
                <PWText
                    variant='caption'
                    style={styles.unavailableText}
                >
                    {t('signing.balance_impact.unavailable')}
                </PWText>
            </PWView>
        )
    }

    if (!hasImpact) {
        // App-call movements only appear once simulation resolves the inner
        // txns — surface that rather than flashing empty → populated.
        if (isSimulating) {
            return (
                <PWView
                    style={styles.container}
                    testID='balance-impact-summary'
                >
                    <PWText
                        variant='caption'
                        style={styles.sectionTitle}
                    >
                        {t('signing.balance_impact.analyzing')}
                    </PWText>
                </PWView>
            )
        }
        return null
    }

    return (
        <PWView
            style={styles.container}
            testID='balance-impact-summary'
        >
            <Section
                title={t('signing.balance_impact.receive_title')}
                items={receive}
            />
            <Section
                title={t('signing.balance_impact.spend_title')}
                items={spend}
            />
        </PWView>
    )
}

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
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { useStyles } from './styles'
import { MigrationRow } from '../MigrationRow'

export type PlanCardProps = { plan: MigrationPlanSummary }

export const PlanCard = ({ plan }: PlanCardProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.planCard}>
            <PWView style={styles.planHeader}>
                <PWText
                    variant='h4'
                    style={styles.planTitle}
                >
                    {plan.dbName}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.planMeta}
                >
                    {`target v${plan.targetVersion} · floor v${plan.oldestSupported}`}
                </PWText>
            </PWView>

            <PWText
                variant='body'
                style={styles.readerImpact}
            >
                {plan.readerImpact}
            </PWText>

            {plan.migrations.map(migration => (
                <MigrationRow
                    key={`${migration.from}-${migration.to}`}
                    migration={migration}
                />
            ))}
        </PWView>
    )
}

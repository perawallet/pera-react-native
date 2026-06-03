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

import { PWScrollView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type {
    BundledMigrationSummary,
    MigrationPlanSummary,
} from '@perawallet/wallet-extension-platform'
import { useStyles } from './styles'
import { useMigrationPlans } from './useMigrationPlans'

export const SettingsDeveloperMigrationInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { plans, isLoading, error } = useMigrationPlans()

    if (isLoading) {
        return (
            <PWView style={styles.centered}>
                <PWText>{t('common.loading.label')}</PWText>
            </PWView>
        )
    }

    if (error) {
        return (
            <PWView style={styles.centered}>
                <PWText variant='h4'>Failed to load migration plans</PWText>
                <PWText>{error.message}</PWText>
            </PWView>
        )
    }

    return (
        <PWScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
        >
            <PWText
                variant='body'
                style={styles.intro}
            >
                Each card below describes one legacy database the migration
                reads. The replay engine brings older schema versions up to the
                target before any data is read.
            </PWText>

            {plans.length === 0 ? (
                <PWText
                    variant='body'
                    style={styles.emptyState}
                >
                    No migration plans reported by the native module. (Expected
                    on iOS — iOS adapter has no bundled migrations.)
                </PWText>
            ) : (
                plans.map(plan => (
                    <PlanCard
                        key={plan.dbName}
                        plan={plan}
                    />
                ))
            )}
        </PWScrollView>
    )
}

const PlanCard = ({ plan }: { plan: MigrationPlanSummary }) => {
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

const MigrationRow = ({
    migration,
}: {
    migration: BundledMigrationSummary
}) => {
    const styles = useStyles()
    return (
        <PWView style={styles.migrationRow}>
            <PWText
                variant='body'
                style={styles.migrationStep}
            >
                {`${migration.from} → ${migration.to}`}
            </PWText>
            <PWText
                variant='body'
                style={styles.migrationDescription}
            >
                {migration.description}
            </PWText>
        </PWView>
    )
}

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

import { PWScrollView, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useMigrationPlans } from './useMigrationPlans'
import { PlanCard } from './PlanCard'

export const SettingsDeveloperMigrationInfoScreen = () => {
    const styles = useStyles()
    const { plans, isLoading, error } = useMigrationPlans()

    if (isLoading) {
        return (
            <PWView style={styles.centered}>
                <PWText>Loading…</PWText>
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

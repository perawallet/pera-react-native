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

import { Alert, Platform } from 'react-native'
import {
    PWButton,
    PWCheckbox,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { LegacyDatabaseCard } from './components/LegacyDatabaseCard'
import { ResultLine } from './components/ResultLine'
import { useStyles } from './styles'
import { useMigrationSimulator } from './useMigrationSimulator'

export const SettingsDeveloperMigrationSimulatorScreen = () => {
    const styles = useStyles()
    const {
        plans,
        isLoadingPlans,
        loadError,
        selectedVersions,
        setSelectedVersion,
        includeUnroutable,
        setIncludeUnroutable,
        includeAuthState,
        setIncludeAuthState,
        generatePreSixxAccounts,
        lastGenerated,
        results,
        isWorking,
        generate,
        reset,
    } = useMigrationSimulator()

    if (isLoadingPlans) {
        return (
            <PWView style={styles.centered}>
                <PWText>Loading…</PWText>
            </PWView>
        )
    }

    if (loadError) {
        return (
            <PWView style={styles.centered}>
                <PWText variant='h4'>Failed to load migration plans</PWText>
                <PWText>{loadError.message}</PWText>
            </PWView>
        )
    }

    const handleGeneratePressed = () => {
        Alert.alert(
            'Generate legacy databases?',
            'Overwrites any existing legacy database on this device with ' +
                'synthetic QA fixtures. Existing legacy data will be replaced ' +
                'and cannot be recovered.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Generate',
                    style: 'destructive',
                    onPress: () => {
                        void generate()
                    },
                },
            ],
        )
    }

    const handleGeneratePreSixxPressed = () => {
        Alert.alert(
            'Generate pre-6.x accounts?',
            'Overwrites the legacy pre-6.x accounts blob on this device with ' +
                'synthetic QA data. Existing data will be replaced and cannot ' +
                'be recovered.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Generate',
                    style: 'destructive',
                    onPress: () => {
                        void generatePreSixxAccounts()
                    },
                },
            ],
        )
    }

    const handleResetPressed = () => {
        Alert.alert(
            'Reset legacy data?',
            'Wipes every simulated legacy database and clears the migration ' +
                'sentinel. Cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        void reset()
                    },
                },
            ],
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
                Pick a legacy schema version for each database, tap Generate,
                then return to the Migration Viewer and tap Migrate to exercise
                the replay.
            </PWText>

            {plans.length === 0 ? (
                <PWText style={styles.intro}>
                    No migration plans reported by the native module. (iOS or an
                    unregistered native module.)
                </PWText>
            ) : (
                plans.map(plan => (
                    <LegacyDatabaseCard
                        key={plan.dbName}
                        plan={plan}
                        selectedVersion={
                            selectedVersions[plan.dbName] ??
                            plan.oldestSupported
                        }
                        onSelectVersion={version =>
                            setSelectedVersion(plan.dbName, version)
                        }
                        lastGenerated={lastGenerated[plan.dbName]}
                        disabled={isWorking}
                    />
                ))
            )}

            <PWView style={styles.qaToggle}>
                <PWView style={styles.qaToggleRow}>
                    <PWCheckbox
                        checked={includeUnroutable}
                        onPress={() => setIncludeUnroutable(!includeUnroutable)}
                        disabled={isWorking}
                        containerStyle={styles.qaCheckboxContainer}
                    />
                    <PWText
                        variant='body'
                        style={styles.qaToggleLabel}
                    >
                        Include unroutable accounts (QA)
                    </PWText>
                </PWView>
                <PWText
                    variant='caption'
                    style={styles.qaToggleHint}
                >
                    Adds a standard account with no key (plus a null-id ledger
                    on iOS) so the migration reports failures and does not
                    complete. Leave off for a clean, fully-routable run.
                </PWText>

                <PWView style={styles.qaToggleRow}>
                    <PWCheckbox
                        checked={includeAuthState}
                        onPress={() => setIncludeAuthState(!includeAuthState)}
                        disabled={isWorking}
                        containerStyle={styles.qaCheckboxContainer}
                    />
                    <PWText
                        variant='body'
                        style={styles.qaToggleLabel}
                    >
                        Include auth — PIN / biometric (QA)
                    </PWText>
                </PWView>
                <PWText
                    variant='caption'
                    style={styles.qaToggleHint}
                >
                    Populates the legacy PIN (123456), biometric flag and
                    lockout, so the migrated app starts locked. Leave off to
                    open the app unlocked.
                </PWText>
            </PWView>

            <PWView style={styles.actionsRow}>
                <PWView style={styles.actionButton}>
                    <PWButton
                        variant='primary'
                        title={isWorking ? 'Working…' : 'Generate DBs'}
                        onPress={handleGeneratePressed}
                        isDisabled={isWorking || plans.length === 0}
                    />
                </PWView>
            </PWView>
            {Platform.OS === 'android' && (
                <PWView style={styles.actionsRow}>
                    <PWView style={styles.actionButton}>
                        <PWButton
                            variant='primary'
                            title={isWorking ? 'Working…' : 'Generate pre-6.x'}
                            onPress={handleGeneratePreSixxPressed}
                            isDisabled={isWorking}
                        />
                    </PWView>
                </PWView>
            )}
            <PWView style={styles.actionsRow}>
                <PWView style={styles.actionButton}>
                    <PWButton
                        variant='secondary'
                        title='Reset'
                        onPress={handleResetPressed}
                        isDisabled={isWorking}
                    />
                </PWView>
            </PWView>

            {results.length > 0 && (
                <PWView style={styles.resultPanel}>
                    <PWText
                        variant='h4'
                        style={styles.resultTitle}
                    >
                        Result
                    </PWText>
                    {results.map(row => (
                        <ResultLine
                            key={row.dbName}
                            row={row}
                        />
                    ))}
                </PWView>
            )}
        </PWScrollView>
    )
}

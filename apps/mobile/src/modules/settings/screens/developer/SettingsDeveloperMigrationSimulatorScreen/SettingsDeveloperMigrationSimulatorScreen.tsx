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
    PWDropdown,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { useStyles } from './styles'
import { useMigrationSimulator, type ResultRow } from './useMigrationSimulator'

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
                    <DbCard
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
                        onPress={() => {
                            void generate()
                        }}
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
                            onPress={() => {
                                void generatePreSixxAccounts()
                            }}
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

const DbCard = ({
    plan,
    selectedVersion,
    onSelectVersion,
    lastGenerated,
    disabled,
}: {
    plan: MigrationPlanSummary
    selectedVersion: number
    onSelectVersion: (version: number) => void
    lastGenerated: { version: number; at: number } | undefined
    disabled: boolean
}) => {
    const styles = useStyles()
    const versions: number[] = []
    for (let v = plan.oldestSupported; v <= plan.targetVersion; v += 1) {
        versions.push(v)
    }
    const isSingleSnapshot = versions.length <= 1
    return (
        <PWView style={styles.dbCard}>
            <PWView style={styles.dbCardHeader}>
                <PWText
                    variant='h4'
                    style={styles.dbCardTitle}
                >
                    {plan.dbName}
                </PWText>
                {!isSingleSnapshot && (
                    <PWText
                        variant='caption'
                        style={styles.dbCardRange}
                    >
                        range v{plan.oldestSupported}..v{plan.targetVersion}
                    </PWText>
                )}
            </PWView>

            {isSingleSnapshot ? (
                <PWText
                    variant='body'
                    style={styles.snapshotNote}
                >
                    single snapshot · no schema versions
                </PWText>
            ) : (
                <PWView style={styles.versionRow}>
                    <PWText
                        variant='body'
                        style={styles.versionLabel}
                    >
                        user_version
                    </PWText>
                    <PWDropdown
                        align='right'
                        items={versions.map(v => ({
                            label: `v${v}`,
                            onPress: () => {
                                if (!disabled) onSelectVersion(v)
                            },
                        }))}
                    >
                        <PWView style={styles.versionChip}>
                            <PWText
                                variant='body'
                                style={styles.versionChipText}
                            >
                                v{selectedVersion}
                            </PWText>
                            <PWIcon
                                name='chevron-down'
                                size='sm'
                            />
                        </PWView>
                    </PWDropdown>
                </PWView>
            )}

            <PWText
                variant='caption'
                style={styles.lastGenerated}
            >
                last generated{' '}
                {lastGenerated
                    ? isSingleSnapshot
                        ? formatRelative(lastGenerated.at)
                        : `v${lastGenerated.version} · ${formatRelative(lastGenerated.at)}`
                    : '—'}
            </PWText>
        </PWView>
    )
}

const ResultLine = ({ row }: { row: ResultRow }) => {
    const styles = useStyles()
    const { icon, iconVariant, detail } = describeOutcome(row.outcome)
    return (
        <PWView style={styles.resultRow}>
            <PWView style={styles.resultStatusIcon}>
                <PWIcon
                    name={icon}
                    size='sm'
                    variant={iconVariant}
                />
            </PWView>
            <PWText
                variant='body'
                style={styles.resultDbName}
            >
                {row.dbName}
            </PWText>
            <PWText
                variant='body'
                style={styles.resultDetail}
            >
                {detail}
            </PWText>
        </PWView>
    )
}

const describeOutcome = (
    outcome: ResultRow['outcome'],
): {
    icon: 'check' | 'cross' | 'info'
    iconVariant: 'positive' | 'error' | 'helper'
    detail: string
} => {
    switch (outcome.kind) {
        case 'pending':
            return { icon: 'info', iconVariant: 'helper', detail: 'Working…' }
        case 'success':
            return outcome.version === 0
                ? { icon: 'check', iconVariant: 'positive', detail: 'Reset' }
                : {
                      icon: 'check',
                      iconVariant: 'positive',
                      detail: `v${outcome.version}`,
                  }
        case 'done':
            return {
                icon: 'check',
                iconVariant: 'positive',
                detail: outcome.detail,
            }
        case 'error':
            return {
                icon: 'cross',
                iconVariant: 'error',
                detail: outcome.message,
            }
    }
}

const formatRelative = (at: number): string => {
    const deltaSec = Math.max(0, Math.round((Date.now() - at) / 1000))
    if (deltaSec < 60) return `${deltaSec}s ago`
    const deltaMin = Math.round(deltaSec / 60)
    if (deltaMin < 60) return `${deltaMin} min ago`
    const deltaHr = Math.round(deltaMin / 60)
    return `${deltaHr} hr ago`
}

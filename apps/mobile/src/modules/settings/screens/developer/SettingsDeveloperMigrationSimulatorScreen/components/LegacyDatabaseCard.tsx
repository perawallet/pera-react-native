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

import { PWDropdown, PWIcon, PWText, PWView } from '@components/core'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { useStyles } from '../styles'

type LegacyDatabaseCardProps = {
    plan: MigrationPlanSummary
    selectedVersion: number
    onSelectVersion: (version: number) => void
    lastGenerated: { version: number; at: number } | undefined
    disabled: boolean
}

export const LegacyDatabaseCard = ({
    plan,
    selectedVersion,
    onSelectVersion,
    lastGenerated,
    disabled,
}: LegacyDatabaseCardProps) => {
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

const formatRelative = (at: number): string => {
    const deltaSec = Math.max(0, Math.round((Date.now() - at) / 1000))
    if (deltaSec < 60) return `${deltaSec}s ago`
    const deltaMin = Math.round(deltaSec / 60)
    if (deltaMin < 60) return `${deltaMin} min ago`
    const deltaHr = Math.round(deltaMin / 60)
    return `${deltaHr} hr ago`
}

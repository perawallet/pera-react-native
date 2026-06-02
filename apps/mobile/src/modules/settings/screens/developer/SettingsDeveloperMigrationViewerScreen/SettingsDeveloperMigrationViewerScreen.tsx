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

import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react'
import {
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type {
    LegacyAccount,
    LegacyMigrationData,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useMigrationGateStore } from '@modules/migration/hooks'
import type { MigrationRunResult } from '@migration/runMigration'
import type { ExtrasMigrationResult } from '@migration/runExtrasMigration'
import type { MigrationResult } from '@migration/types'
import { AccountsSection } from './sections/AccountsSection'
import { AuthSection } from './sections/AuthSection'
import { ContactsSection } from './sections/ContactsSection'
import { DeviceIdentifiersSection } from './sections/DeviceIdentifiersSection'
import { HDWalletsSection } from './sections/HDWalletsSection'
import { NotificationFiltersSection } from './sections/NotificationFiltersSection'
import { PasskeysSection } from './sections/PasskeysSection'
import { PreferencesSection } from './sections/PreferencesSection'
import { RawFlagsSection } from './sections/RawFlagsSection'
import { SchemaReplayResultsSection } from './sections/SchemaReplayResultsSection'
import {
    WalletConnectV1Section,
    WalletConnectV2Section,
} from './sections/WalletConnectSection'
import { useStyles } from './styles'
import { useSettingsDeveloperMigrationViewerScreen } from './useSettingsDeveloperMigrationViewerScreen'
import { useRunMigration } from './useRunMigration'
import { useRNMigrationSnapshot } from './useRNMigrationSnapshot'

export const SettingsDeveloperMigrationViewerScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { data, isLoading, error, isMigrationComplete, refresh } =
        useSettingsDeveloperMigrationViewerScreen()
    const {
        run: runMigrationFlow,
        isMigrating,
        result: runResult,
        error: runError,
    } = useRunMigration()
    const rn = useRNMigrationSnapshot()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const skipped = useMigrationGateStore(state => state.skipped)
    const clearSkipped = useMigrationGateStore(state => state.clearSkipped)
    const [expandAll, setExpandAll] = useState<ExpandAllSignal>({
        expand: false,
        generation: 0,
    })

    const isAnyMigrationRunning = isMigrating

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
                <PWText variant='h4'>
                    {t('settings.developer.migration_viewer.error_title')}
                </PWText>
                <PWText>{error.message}</PWText>
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.migration_viewer.refresh')}
                    onPress={refresh}
                />
            </PWView>
        )
    }

    if (!data) return null

    return (
        <PWScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
        >
            <StatusBanner
                data={data}
                isMigrationComplete={isMigrationComplete}
            />

            <PWView style={styles.actionsRow}>
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.migration_viewer.refresh')}
                    onPress={refresh}
                    isDisabled={isAnyMigrationRunning}
                />
                <PWButton
                    variant='secondary'
                    title={
                        expandAll.expand
                            ? t(
                                  'settings.developer.migration_viewer.collapse_all',
                              )
                            : t(
                                  'settings.developer.migration_viewer.expand_all',
                              )
                    }
                    onPress={() =>
                        setExpandAll(prev => ({
                            expand: !prev.expand,
                            generation: prev.generation + 1,
                        }))
                    }
                />
                <PWButton
                    variant='primary'
                    title={
                        isAnyMigrationRunning
                            ? t('settings.developer.migration_viewer.migrating')
                            : t('settings.developer.migration_viewer.migrate')
                    }
                    onPress={() => {
                        void (async () => {
                            await runMigrationFlow()
                            refresh()
                        })()
                    }}
                    isDisabled={isAnyMigrationRunning}
                />
                <PWButton
                    variant='secondary'
                    title={t(
                        'settings.developer.migration_viewer.clear_migration_complete',
                    )}
                    onPress={() => {
                        void (async () => {
                            await getProvider().migration.clearMigrationComplete()
                            refresh()
                        })()
                    }}
                    isDisabled={isAnyMigrationRunning || !isMigrationComplete}
                />
                <PWButton
                    variant='secondary'
                    title={t(
                        'settings.developer.migration_viewer.clear_skip_permanently',
                    )}
                    onPress={clearSkipped}
                    isDisabled={isAnyMigrationRunning || !skipped}
                />
            </PWView>

            <DevToolsSection navigation={navigation} />

            <RunResultBanner
                result={runResult}
                error={runError}
            />

            <ExpandAllContext.Provider value={expandAll}>
                <CollapsibleSection
                    title={t(
                        'settings.developer.migration_viewer.section_identity',
                    )}
                >
                    <InlineRow
                        label='schemaVersion'
                        value={data.schemaVersion}
                    />
                    <InlineRow
                        label='sourcePlatform'
                        value={data.sourcePlatform}
                    />
                    <InlineRow
                        label='walletConnectHistoryBlob'
                        value={data.walletConnectHistoryBlob}
                    />
                </CollapsibleSection>

                <SchemaReplayResultsSection
                    results={data.schemaReplayResults}
                />

                <PreferencesSection
                    preferences={data.preferences}
                    rn={rn}
                />

                <AuthSection
                    auth={data.auth}
                    biometricEnabled={data.preferences.biometricEnabled}
                    rn={rn}
                />

                <AccountsSection
                    accounts={data.accounts}
                    rn={rn}
                />
                <HDWalletsSection hdWallets={data.hdWallets} />
                <ContactsSection
                    contacts={data.contacts}
                    rn={rn}
                />

                <NotificationFiltersSection
                    filters={data.notificationFilters}
                    rn={rn}
                />

                <WalletConnectV1Section sessions={data.walletConnectV1} />
                <WalletConnectV2Section sessions={data.walletConnectV2} />
                <PasskeysSection passkeys={data.passkeys} />
                <DeviceIdentifiersSection
                    deviceIdentifiers={data.deviceIdentifiers}
                    rn={rn}
                />
                <RawFlagsSection rawFlags={data.preferences.rawFlags} />
            </ExpandAllContext.Provider>
        </PWScrollView>
    )
}

const StatusBanner = ({
    data,
    isMigrationComplete,
}: {
    data: LegacyMigrationData
    isMigrationComplete: boolean
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <PWView style={styles.statusBanner}>
            <PWText
                variant='h4'
                style={styles.statusBannerTitle}
            >
                {t('settings.developer.migration_viewer.banner_title')}
            </PWText>
            <InlineRow
                label='sourcePlatform'
                value={data.sourcePlatform}
            />
            <InlineRow
                label='schemaVersion'
                value={data.schemaVersion}
            />
            <InlineRow
                label='isMigrationComplete'
                value={isMigrationComplete}
            />
        </PWView>
    )
}

const DevToolsSection = ({
    navigation,
}: {
    navigation: NativeStackNavigationProp<ParamListBase>
}) => {
    const styles = useStyles()
    return (
        <>
            <PWView style={styles.devToolsDivider} />
            <PWText
                variant='caption'
                style={styles.devToolsLabel}
            >
                Dev tools
            </PWText>
            <PWView style={styles.devToolsRow}>
                <PWView style={styles.devToolsButton}>
                    <PWButton
                        variant='secondary'
                        title='Migrations info'
                        onPress={() => navigation.push('MigrationInfo')}
                    />
                </PWView>
                <PWView style={styles.devToolsButton}>
                    <PWButton
                        variant='secondary'
                        title='Simulator'
                        onPress={() => navigation.push('MigrationSimulator')}
                    />
                </PWView>
            </PWView>
        </>
    )
}

const RunResultBanner = ({
    result,
    error,
}: {
    result: MigrationRunResult | null
    error: Error | null
}) => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (error) {
        return (
            <PWView style={styles.statusBanner}>
                <PWText
                    variant='h4'
                    style={styles.statusBannerTitle}
                >
                    {t(
                        'settings.developer.migration_viewer.migrate_error_title',
                    )}
                </PWText>
                <PWText>{error.message}</PWText>
            </PWView>
        )
    }

    if (!result) return null

    return (
        <PWView style={styles.statusBanner}>
            <PWText
                variant='h4'
                style={styles.statusBannerTitle}
            >
                {t('settings.developer.migration_viewer.migrate_result_title')}
            </PWText>
            <InlineRow
                label='completed'
                value={result.completed}
            />
            {result.incompleteReason && (
                <InlineRow
                    label='incompleteReason'
                    value={result.incompleteReason}
                />
            )}
            {result.error && (
                <StackedRow
                    label='error'
                    value={result.error.message}
                />
            )}
            {result.accounts && (
                <AccountsResultRows accounts={result.accounts} />
            )}
            {result.extras && <ExtrasResultRows extras={result.extras} />}
        </PWView>
    )
}

const AccountsResultRows = ({ accounts }: { accounts: MigrationResult }) => {
    const { t } = useLanguage()
    return (
        <>
            <InlineRow
                label={t(
                    'settings.developer.migration_viewer.migrate_result_imported',
                )}
                value={accounts.imported}
            />
            <InlineRow
                label={t(
                    'settings.developer.migration_viewer.migrate_result_skipped',
                )}
                value={accounts.skipped}
            />
            <InlineRow
                label={t(
                    'settings.developer.migration_viewer.migrate_result_failed',
                )}
                value={accounts.failed.length}
            />
            {accounts.failed.map((f, i) => (
                <StackedRow
                    key={`${f.address}-${i}`}
                    label={`${f.name || truncateAddress(f.address)}`}
                    value={f.reason}
                />
            ))}
        </>
    )
}

const ExtrasResultRows = ({ extras }: { extras: ExtrasMigrationResult }) => (
    <>
        <InlineRow
            label='preferences'
            value={extras.preferences}
        />
        <InlineRow
            label='swaps'
            value={extras.swaps}
        />
        <InlineRow
            label='deviceIdentifiers'
            value={extras.deviceIdentifiers}
        />
        <InlineRow
            label='contacts imported'
            value={extras.contacts.imported}
        />
        <InlineRow
            label='contacts skipped'
            value={extras.contacts.skipped}
        />
        <InlineRow
            label='notifications muted'
            value={extras.notifications.muted}
        />
        <InlineRow
            label='pin migrated'
            value={extras.auth.pinMigrated}
        />
        <InlineRow
            label='biometric migrated'
            value={extras.auth.biometricMigrated}
        />
        <InlineRow
            label='lockout migrated'
            value={extras.auth.lockoutMigrated}
        />
        <InlineRow
            label='passkeys stashed'
            value={extras.stashed.passkeysStashed}
        />
        <InlineRow
            label='extras steps failed'
            value={extras.failed.length}
        />
        {extras.failed.map((f, i) => (
            <StackedRow
                key={`${f.step}-${i}`}
                label={f.step}
                value={f.reason}
            />
        ))}
    </>
)

type ExpandAllSignal = { expand: boolean; generation: number }
const ExpandAllContext = createContext<ExpandAllSignal | null>(null)

export const useExpandableState = (initial: boolean) => {
    const ctx = useContext(ExpandAllContext)
    const [expanded, setExpanded] = useState(initial)
    const lastGen = useRef<number | null>(null)
    useEffect(() => {
        if (ctx && ctx.generation !== lastGen.current) {
            lastGen.current = ctx.generation
            setExpanded(ctx.expand)
        }
    }, [ctx])
    return [expanded, setExpanded] as const
}

type CollapsibleSectionProps = {
    title: string
    count?: number
    initiallyExpanded?: boolean
    children: ReactNode
}

export const CollapsibleSection = ({
    title,
    count,
    initiallyExpanded = false,
    children,
}: CollapsibleSectionProps) => {
    const styles = useStyles()
    const [expanded, setExpanded] = useExpandableState(initiallyExpanded)

    return (
        <PWView>
            <PWTouchableOpacity onPress={() => setExpanded(prev => !prev)}>
                <PWView style={styles.sectionHeader}>
                    <PWView style={styles.sectionHeaderLeft}>
                        <PWText
                            variant='h4'
                            style={styles.sectionTitle}
                        >
                            {title}
                        </PWText>
                        {count !== undefined && (
                            <PWView style={styles.countChip}>
                                <PWText
                                    variant='caption'
                                    style={styles.countChipText}
                                >
                                    {count}
                                </PWText>
                            </PWView>
                        )}
                    </PWView>
                    <PWIcon
                        name={expanded ? 'chevron-down' : 'chevron-right'}
                        size='sm'
                    />
                </PWView>
            </PWTouchableOpacity>
            {expanded && <PWView style={styles.sectionBody}>{children}</PWView>}
        </PWView>
    )
}

type RowProps = { label: string; value: unknown }

export const InlineRow = ({ label, value }: RowProps) => {
    if (shouldStack(value)) {
        return (
            <StackedRow
                label={label}
                value={value}
            />
        )
    }
    return (
        <InlineRowImpl
            label={label}
            value={value}
        />
    )
}

const InlineRowImpl = ({ label, value }: RowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.inlineRow}>
            <PWText
                variant='body'
                style={styles.inlineRowLabel}
            >
                {label}
            </PWText>
            <PWText
                variant='body'
                style={styles.inlineRowValue}
                numberOfLines={1}
                ellipsizeMode='middle'
            >
                {formatValue(value)}
            </PWText>
        </PWView>
    )
}

export const StackedRow = ({ label, value }: RowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.stackedRow}>
            <PWText
                variant='body'
                style={styles.stackedRowLabel}
            >
                {label}
            </PWText>
            <PWText
                variant='body'
                style={[styles.stackedRowValue, styles.monospaceValue]}
            >
                {formatValue(value)}
            </PWText>
        </PWView>
    )
}

export const EmptyHint = () => {
    const styles = useStyles()
    return (
        <PWText
            variant='body'
            style={styles.empty}
        >
            {'(empty)'}
        </PWText>
    )
}

export const SubBlock = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => {
    const styles = useStyles()
    return (
        <PWView style={styles.subBlock}>
            <PWText
                variant='body'
                style={styles.subBlockTitle}
            >
                {title}
            </PWText>
            {children}
        </PWView>
    )
}

type ComparisonRowProps = {
    label: string
    legacyValue: unknown
    rnValue: unknown
    matches?: boolean
}

export const ComparisonRow = ({
    label,
    legacyValue,
    rnValue,
    matches,
}: ComparisonRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.comparisonRow}>
            <PWView style={styles.comparisonHeader}>
                <PWText
                    variant='body'
                    style={styles.comparisonLabel}
                >
                    {label}
                </PWText>
                {matches !== undefined && (
                    <PWText
                        variant='body'
                        style={[
                            styles.comparisonStatus,
                            matches
                                ? styles.comparisonStatusOk
                                : styles.comparisonStatusWarn,
                        ]}
                    >
                        {matches ? '✓' : '⚠'}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.comparisonLine}>
                <PWText
                    variant='body'
                    style={styles.comparisonTag}
                >
                    Device
                </PWText>
                <PWText
                    variant='body'
                    style={styles.comparisonValue}
                >
                    {formatValue(legacyValue)}
                </PWText>
            </PWView>
            <PWView style={styles.comparisonLine}>
                <PWText
                    variant='body'
                    style={styles.comparisonTag}
                >
                    RN
                </PWText>
                <PWText
                    variant='body'
                    style={styles.comparisonValue}
                >
                    {formatValue(rnValue)}
                </PWText>
            </PWView>
        </PWView>
    )
}

const shouldStack = (value: unknown): boolean => {
    if (value instanceof Uint8Array) return true
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.length > 32
    return value !== null && typeof value === 'object'
}

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(null)'
    if (value instanceof Uint8Array) {
        if (value.length === 0) return 'Uint8Array(0) []'
        const preview = Array.from(value.slice(0, 8))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
        return `Uint8Array(${value.length}) [${preview}${value.length > 8 ? ' …' : ''}]`
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]'
        try {
            return JSON.stringify(value)
        } catch {
            return `Array(${value.length})`
        }
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') {
        if (value.length === 0) return '""'
        if (ALGORAND_ADDRESS_RE.test(value)) return truncateAddress(value)
        return value
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return '[Object]'
        }
    }
    return String(value)
}

export const truncateAddress = (address: string): string => {
    if (address.length <= 11) return address
    return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const ALGORAND_ADDRESS_RE = /^[A-Z2-7]{58}$/

export const getDisplayType = (account: LegacyAccount): string => {
    if (account.type === 'watch') return 'watch'
    if (account.joint !== null) return 'multisig'
    if (account.ledger !== null) return 'hardware'
    if (account.hdWalletId !== null) return 'hdWallet'
    return 'algo25'
}

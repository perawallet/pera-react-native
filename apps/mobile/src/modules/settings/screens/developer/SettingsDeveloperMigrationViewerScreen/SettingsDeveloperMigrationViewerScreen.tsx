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

import { useState } from 'react'
import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useMigrationGateStore } from '@perawallet/wallet-core-migrate'
import {
    ExpandAllContext,
    MigrationDataSection,
    type ExpandAllSignal,
} from './components/MigrationDataSection'
import { MigrationDataRow } from './components/MigrationDataRow'
import { MigrationDevToolsRow } from './components/MigrationDevToolsRow'
import { MigrationRunResultBanner } from './components/MigrationRunResultBanner'
import { MigrationSnapshotBanner } from './components/MigrationSnapshotBanner'
import { AccountsSection } from './sections/AccountsSection'
import { AuthSection } from './sections/AuthSection'
import { ContactsSection } from './sections/ContactsSection'
import { DeviceIdentifiersSection } from './sections/DeviceIdentifiersSection'
import { HDWalletsSection } from './sections/HDWalletsSection'
import { MigrationStepsSection } from './sections/MigrationStepsSection'
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
import { useMigrationStepVersions } from './useMigrationStepVersions'

export const SettingsDeveloperMigrationViewerScreen = () => {
    const styles = useStyles()
    const { data, isLoading, error, isMigrationComplete, refresh } =
        useSettingsDeveloperMigrationViewerScreen()
    const {
        run: runMigrationFlow,
        isMigrating,
        result: runResult,
        error: runError,
    } = useRunMigration()
    const rn = useRNMigrationSnapshot()
    const { steps: migrationSteps, refresh: refreshMigrationSteps } =
        useMigrationStepVersions()
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
                <PWText>Loading…</PWText>
            </PWView>
        )
    }

    if (error) {
        return (
            <PWView style={styles.centered}>
                <PWText variant='h4'>Failed to read legacy data</PWText>
                <PWText>{error.message}</PWText>
                <PWButton
                    variant='secondary'
                    title='Refresh'
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
            <MigrationSnapshotBanner
                data={data}
                isMigrationComplete={isMigrationComplete}
            />

            <PWView style={styles.actionsRow}>
                <PWButton
                    variant='secondary'
                    title='Refresh'
                    onPress={() => {
                        refresh()
                        refreshMigrationSteps()
                    }}
                    isDisabled={isAnyMigrationRunning}
                />
                <PWButton
                    variant='secondary'
                    title={expandAll.expand ? 'Collapse all' : 'Expand all'}
                    onPress={() =>
                        setExpandAll(prev => ({
                            expand: !prev.expand,
                            generation: prev.generation + 1,
                        }))
                    }
                />
                <PWButton
                    variant='primary'
                    title={isAnyMigrationRunning ? 'Migrating…' : 'Migrate'}
                    onPress={() => {
                        void (async () => {
                            await runMigrationFlow()
                            refresh()
                            refreshMigrationSteps()
                        })()
                    }}
                    isDisabled={isAnyMigrationRunning}
                />
                <PWButton
                    variant='secondary'
                    title='Clear migration complete'
                    onPress={() => {
                        void (async () => {
                            await getProvider().migration.clearMigrationComplete()
                            refresh()
                            refreshMigrationSteps()
                        })()
                    }}
                    isDisabled={isAnyMigrationRunning || !isMigrationComplete}
                />
                <PWButton
                    variant='secondary'
                    title='Clear skip permanently'
                    onPress={clearSkipped}
                    isDisabled={isAnyMigrationRunning || !skipped}
                />
            </PWView>

            <MigrationDevToolsRow navigation={navigation} />

            <MigrationRunResultBanner
                result={runResult}
                error={runError}
            />

            <ExpandAllContext.Provider value={expandAll}>
                <MigrationDataSection title='Identity'>
                    <MigrationDataRow
                        label='schemaVersion'
                        value={data.schemaVersion}
                    />
                    <MigrationDataRow
                        label='sourcePlatform'
                        value={data.sourcePlatform}
                    />
                    <MigrationDataRow
                        label='walletConnectHistoryBlob'
                        value={data.walletConnectHistoryBlob}
                    />
                </MigrationDataSection>

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
                <MigrationStepsSection steps={migrationSteps} />
                <RawFlagsSection rawFlags={data.preferences.rawFlags} />
            </ExpandAllContext.Provider>
        </PWScrollView>
    )
}

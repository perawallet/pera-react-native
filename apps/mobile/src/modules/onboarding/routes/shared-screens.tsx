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

import type React from 'react'
import type { createNativeStackNavigator } from '@react-navigation/native-stack'

import { AccountErrorBoundary } from '@modules/accounts/components/AccountErrorBoundary/AccountErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { fullScreenLayout } from '@layouts/index'

import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen'
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen'
import { AsbImportInfoScreen } from '@modules/onboarding/screens/AsbImportInfoScreen'
import { AsbImportBackupScreen } from '@modules/onboarding/screens/AsbImportBackupScreen'
import { AsbImportKeyScreen } from '@modules/onboarding/screens/AsbImportKeyScreen'
import { AsbImportSelectAccountsScreen } from '@modules/onboarding/screens/AsbImportSelectAccountsScreen'
import { AsbImportResultScreen } from '@modules/onboarding/screens/AsbImportResultScreen'
import { PeraWebImportInfoScreen } from '@modules/onboarding/screens/PeraWebImportInfoScreen'
import { PeraWebImportLoadingScreen } from '@modules/onboarding/screens/PeraWebImportLoadingScreen'
import { PeraWebImportResultScreen } from '@modules/onboarding/screens/PeraWebImportResultScreen'
import {
    LedgerInstructionsScreen,
    LedgerPairScreen,
    LedgerScanScreen,
    LedgerFetchAccountsScreen,
    LedgerSelectAccountsScreen,
    LedgerVerifyScreen,
    LedgerTroubleshootingScreen,
} from '@modules/ledger'

import type { ImportFlowParamList } from './types'

export const withAccountErrorBoundary = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> => {
    return (props: P) => {
        const { t } = useLanguage()
        return (
            <AccountErrorBoundary t={t}>
                <WrappedComponent {...props} />
            </AccountErrorBoundary>
        )
    }
}

const ImportAccountOptionsScreenWithErrorBoundary = withAccountErrorBoundary(
    ImportAccountOptionsScreen,
)
const NameAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(NameAccountScreen)
const ImportAccountScreenWithErrorBoundary =
    withAccountErrorBoundary(ImportAccountScreen)
const ImportInfoScreenWithErrorBoundary =
    withAccountErrorBoundary(ImportInfoScreen)
const SearchAccountsScreenWithErrorBoundary =
    withAccountErrorBoundary(SearchAccountsScreen)
const ImportSelectAddressesScreenWithErrorBoundary = withAccountErrorBoundary(
    ImportSelectAddressesScreen,
)
const ImportRekeyedAddressesScreenWithErrorBoundary = withAccountErrorBoundary(
    ImportRekeyedAddressesScreen,
)
const LedgerInstructionsScreenWithErrorBoundary = withAccountErrorBoundary(
    LedgerInstructionsScreen,
)
const LedgerPairScreenWithErrorBoundary =
    withAccountErrorBoundary(LedgerPairScreen)
const LedgerScanScreenWithErrorBoundary =
    withAccountErrorBoundary(LedgerScanScreen)
const LedgerFetchAccountsScreenWithErrorBoundary = withAccountErrorBoundary(
    LedgerFetchAccountsScreen,
)
const LedgerSelectAccountsScreenWithErrorBoundary = withAccountErrorBoundary(
    LedgerSelectAccountsScreen,
)
const LedgerVerifyScreenWithErrorBoundary =
    withAccountErrorBoundary(LedgerVerifyScreen)
const LedgerTroubleshootingScreenWithErrorBoundary = withAccountErrorBoundary(
    LedgerTroubleshootingScreen,
)
const AsbImportInfoScreenWithErrorBoundary =
    withAccountErrorBoundary(AsbImportInfoScreen)
const AsbImportBackupScreenWithErrorBoundary = withAccountErrorBoundary(
    AsbImportBackupScreen,
)
const AsbImportKeyScreenWithErrorBoundary =
    withAccountErrorBoundary(AsbImportKeyScreen)
const AsbImportSelectAccountsScreenWithErrorBoundary = withAccountErrorBoundary(
    AsbImportSelectAccountsScreen,
)
const AsbImportResultScreenWithErrorBoundary = withAccountErrorBoundary(
    AsbImportResultScreen,
)
const PeraWebImportInfoScreenWithErrorBoundary = withAccountErrorBoundary(
    PeraWebImportInfoScreen,
)
const PeraWebImportLoadingScreenWithErrorBoundary = withAccountErrorBoundary(
    PeraWebImportLoadingScreen,
)
const PeraWebImportResultScreenWithErrorBoundary = withAccountErrorBoundary(
    PeraWebImportResultScreen,
)

/**
 * Names of every screen registered by `renderImportFlowScreens`. Used by the
 * parity unit test to assert both stack navigators stay in sync.
 */
export const IMPORT_FLOW_SCREEN_NAMES = [
    'ImportAccountOptions',
    'ImportInfo',
    'ImportAccount',
    'NameAccount',
    'SearchAccounts',
    'ImportSelectAddresses',
    'ImportRekeyedAddresses',
    'LedgerPair',
    'LedgerInstructions',
    'LedgerScan',
    'LedgerFetchAccounts',
    'LedgerSelectAccounts',
    'LedgerVerify',
    'LedgerTroubleshooting',
    'AsbImportInfo',
    'AsbImportBackup',
    'AsbImportKey',
    'AsbImportSelectAccounts',
    'AsbImportResult',
    'PeraWebImportInfo',
    'PeraWebImportLoading',
    'PeraWebImportResult',
] as const satisfies ReadonlyArray<keyof ImportFlowParamList>

export type ImportFlowStack = ReturnType<
    typeof createNativeStackNavigator<ImportFlowParamList>
>

/**
 * Renders the screen registrations shared by `OnboardingStackNavigator` and
 * `AddAccountStackNavigator`. Callers pass a stack whose `ParamList` is a
 * superset of `ImportFlowParamList` (both `OnboardingStackParamList` and
 * `AddAccountStackParamList` qualify). React Navigation's
 * `createNativeStackNavigator` is invariant in its `ParamList`, so call sites
 * must use `Stack as unknown as ImportFlowStack` until that ever becomes
 * covariant — see the call sites in `./index.tsx` and `./add-account.tsx`.
 */
export const renderImportFlowScreens = (
    Stack: ImportFlowStack,
): React.ReactNode => (
    <>
        <Stack.Screen
            name='ImportAccountOptions'
            options={{ title: '' }}
            component={ImportAccountOptionsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='ImportInfo'
            options={{ title: '' }}
            component={ImportInfoScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='ImportAccount'
            options={{ title: '' }}
            component={ImportAccountScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='NameAccount'
            options={{ title: '' }}
            component={NameAccountScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='SearchAccounts'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={SearchAccountsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='ImportSelectAddresses'
            options={{ title: '' }}
            component={ImportSelectAddressesScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='ImportRekeyedAddresses'
            options={{ title: '' }}
            component={ImportRekeyedAddressesScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerPair'
            options={{ title: '' }}
            component={LedgerPairScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerInstructions'
            options={{ title: '' }}
            component={LedgerInstructionsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerScan'
            options={{ title: '' }}
            component={LedgerScanScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerFetchAccounts'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={LedgerFetchAccountsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerSelectAccounts'
            options={({ route }) => ({ title: route.params.deviceName })}
            component={LedgerSelectAccountsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerVerify'
            options={{ title: '' }}
            component={LedgerVerifyScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerTroubleshooting'
            options={{ title: '' }}
            component={LedgerTroubleshootingScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='AsbImportInfo'
            options={{ title: '' }}
            component={AsbImportInfoScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='AsbImportBackup'
            options={{ title: '' }}
            component={AsbImportBackupScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='AsbImportKey'
            options={{ title: '' }}
            component={AsbImportKeyScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='AsbImportSelectAccounts'
            options={{ title: '' }}
            component={AsbImportSelectAccountsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='AsbImportResult'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={AsbImportResultScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='PeraWebImportInfo'
            options={{ title: '' }}
            component={PeraWebImportInfoScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='PeraWebImportLoading'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={PeraWebImportLoadingScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='PeraWebImportResult'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={PeraWebImportResultScreenWithErrorBoundary}
        />
    </>
)

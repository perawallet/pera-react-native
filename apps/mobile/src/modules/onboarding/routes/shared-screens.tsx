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

import type React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

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
import {
    LedgerInstructionsScreen,
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
    'LedgerInstructions',
    'LedgerScan',
    'LedgerFetchAccounts',
    'LedgerSelectAccounts',
    'LedgerVerify',
    'LedgerTroubleshooting',
] as const satisfies ReadonlyArray<keyof ImportFlowParamList>

type ImportFlowStack = ReturnType<
    typeof createNativeStackNavigator<ImportFlowParamList>
>

/**
 * Renders the screen registrations shared by `OnboardingStackNavigator` and
 * `AddAccountStackNavigator`. The boundary cast widens the caller's stack
 * typing because both `OnboardingStackParamList` and `AddAccountStackParamList`
 * structurally include every key of `ImportFlowParamList`. If React
 * Navigation's typing of `createNativeStackNavigator` ever supports variance,
 * the cast can be removed.
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
            options={{ title: '' }}
            component={LedgerSelectAccountsScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerVerify'
            options={{ headerShown: false }}
            layout={fullScreenLayout}
            component={LedgerVerifyScreenWithErrorBoundary}
        />
        <Stack.Screen
            name='LedgerTroubleshooting'
            options={{ title: '' }}
            component={LedgerTroubleshootingScreenWithErrorBoundary}
        />
    </>
)

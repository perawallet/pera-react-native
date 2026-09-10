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

import React from 'react'
import { ThemeProvider } from '@rneui/themed'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import type { Persister } from '@tanstack/react-query-persist-client'
import { PeraWalletProvider } from '@perawallet/wallet-extension-provider'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getTheme } from '@theme/theme'
import { QueryProvider } from '../../providers/QueryProvider'
import {
    AutofillPickerScreen,
    type AutofillPickerCaller,
} from './screens/AutofillPickerScreen'

type AutofillPickerRootProps = {
    callerPackage: string
    callerLabel?: string
    callerHost?: string
}

// QueryProvider's persister prop is required, but login queries are already
// excluded from dehydration (shouldDehydrateQuery in query-persistence.ts),
// and this root never runs any other query. A persister that never touches
// storage satisfies the type without pretending disk persistence is wanted.
const noopPersister: Persister = {
    persistClient: () => {},
    restoreClient: () => undefined,
    removeClient: () => {},
}

/**
 * The RN root the autofill picker activity mounts. This screen renders outside
 * the app's normal tree, so it composes the providers it needs itself.
 *
 * PeraWalletProvider is not optional: usePasskeyAutofillService reads the
 * provider through the getProvider() global rather than React context, and
 * throws when nothing has bootstrapped it.
 */
export const AutofillPickerRoot = ({
    callerPackage,
    callerLabel,
    callerHost,
}: AutofillPickerRootProps) => (
    <PeraWalletProvider>
        <ThemedPicker
            caller={{
                packageName: callerPackage,
                label: callerLabel ?? null,
                host: callerHost ?? null,
            }}
        />
    </PeraWalletProvider>
)

// Separate component so useIsDarkMode runs inside PeraWalletProvider: it
// reads the persisted theme setting, which is empty until the provider has
// hydrated the settings store.
const ThemedPicker = ({ caller }: { caller: AutofillPickerCaller }) => {
    const isDarkMode = useIsDarkMode()

    return (
        <ThemeProvider theme={getTheme(isDarkMode ? 'dark' : 'light')}>
            <SafeAreaProvider>
                <QueryProvider persister={noopPersister}>
                    <AutofillPickerScreen caller={caller} />
                </QueryProvider>
            </SafeAreaProvider>
        </ThemeProvider>
    )
}

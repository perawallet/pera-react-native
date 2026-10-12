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

import {
    chainAccountOf,
    findAccountByAddressOn,
    LaunchAccountModes,
    useAccountsStore,
    type LaunchAccountMode,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import {
    useSettingsStore,
    type ConfirmationMode,
} from '@perawallet/wallet-core-settings'
import type { BackupSettings } from '../models'

const CONFIRMATION_MODES: ReadonlySet<string> = new Set<ConfirmationMode>([
    'slide',
    'tap',
])

// Read at call time: a module-scope read of an accounts-package export breaks
// every consumer test that mocks that package without it.
const isLaunchAccountMode = (mode: string): mode is LaunchAccountMode =>
    (Object.values(LaunchAccountModes) as string[]).includes(mode)

export const readBackupSettings = (chainId: ChainId): BackupSettings => {
    const { preferredCurrency, fallbackCurrency } =
        useCurrenciesStore.getState()
    const { language, confirmationMode } = useSettingsStore.getState()
    const { launchAccountMode, launchAccountId, accounts } =
        useAccountsStore.getState()
    // The settings item names the launch account by its address, as the
    // backup format always has.
    const launchAccount = accounts.find(a => a.id === launchAccountId)
    const launchAccountAddress = launchAccount
        ? (chainAccountOf(launchAccount, chainId)?.address ?? null)
        : null
    return {
        currency: { preferred: preferredCurrency, fallback: fallbackCurrency },
        language,
        confirmationMode,
        launchAccount: {
            mode: launchAccountMode,
            address: launchAccountAddress,
        },
    }
}

export const subscribeBackupSettings = (listener: () => void): (() => void) => {
    const unsubscribers = [
        useCurrenciesStore.subscribe(listener),
        useSettingsStore.subscribe(listener),
        useAccountsStore.subscribe(listener),
    ]
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
}

/** The language is written unchecked: the app validates the stored tag
 *  against its own locale set whenever it resolves one. A `specific` launch
 *  account this device does not hold is refused by the accounts store. */
export const applyBackupSettings = (
    settings: Partial<BackupSettings>,
    chainId: ChainId,
): void => {
    const { currency, language, confirmationMode, launchAccount } = settings

    if (currency) {
        const store = useCurrenciesStore.getState()
        store.setPreferredCurrency(currency.preferred)
        store.setFallbackCurrency(currency.fallback)
    }
    if (language) useSettingsStore.getState().setLanguage(language)
    if (confirmationMode && CONFIRMATION_MODES.has(confirmationMode)) {
        useSettingsStore
            .getState()
            .setConfirmationMode(confirmationMode as ConfirmationMode)
    }
    if (launchAccount && isLaunchAccountMode(launchAccount.mode)) {
        const { accounts, setLaunchAccountPreference } =
            useAccountsStore.getState()
        const pinned = launchAccount.address
            ? findAccountByAddressOn(accounts, chainId, launchAccount.address)
            : undefined
        setLaunchAccountPreference(launchAccount.mode, pinned?.id ?? null)
    }
}

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
    AccountSortModes,
    chainAccountOf,
    findAccountByAddressOn,
    findAccountByAnyChainAddress,
    LaunchAccountModes,
    useAccountsStore,
    type AccountSortMode,
    type LaunchAccountMode,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import {
    useSettingsStore,
    type ConfirmationMode,
} from '@perawallet/wallet-core-settings'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { BackupSettings } from '../models'

const CONFIRMATION_MODES: ReadonlySet<string> = new Set<ConfirmationMode>([
    'slide',
    'tap',
])

// Read at call time: a module-scope read of an accounts-package export breaks
// every consumer test that mocks that package without it.
const isLaunchAccountMode = (mode: string): mode is LaunchAccountMode =>
    (Object.values(LaunchAccountModes) as string[]).includes(mode)

const isAccountSortMode = (mode: string): mode is AccountSortMode =>
    (Object.values(AccountSortModes) as string[]).includes(mode)

/** Prefers the scope chain so a multi-chain account has one name everywhere. */
const orderAddressOf = (
    account: WalletAccount,
    chainId: ChainId,
): Optional<string> =>
    chainAccountOf(account, chainId)?.address ??
    Object.values(account.chains).find(entry => entry?.address)?.address

const readAccountOrder = (
    accounts: readonly WalletAccount[],
    manualAccountOrder: readonly string[],
    chainId: ChainId,
): string[] => {
    const byId = new Map(accounts.map(account => [account.id, account]))
    return manualAccountOrder.flatMap(id => {
        const account = byId.get(id)
        const address = account ? orderAddressOf(account, chainId) : undefined
        return address ? [address] : []
    })
}

const applyAccountOrder = (addresses: readonly string[]): void => {
    const { accounts, manualAccountOrder, setManualAccountOrder } =
        useAccountsStore.getState()
    const named = addresses.flatMap(address => {
        const account = findAccountByAnyChainAddress(accounts, address)
        return account ? [account.id] : []
    })
    const namedIds = new Set(named)
    setManualAccountOrder([
        ...namedIds,
        ...manualAccountOrder.filter(id => !namedIds.has(id)),
    ])
}

export const readBackupSettings = (chainId: ChainId): BackupSettings => {
    const { preferredCurrency, fallbackCurrency } =
        useCurrenciesStore.getState()
    const { language, confirmationMode } = useSettingsStore.getState()
    const {
        launchAccountMode,
        launchAccountId,
        accounts,
        sortMode,
        manualAccountOrder,
    } = useAccountsStore.getState()
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
        accountOrder: {
            mode: sortMode,
            addresses: readAccountOrder(accounts, manualAccountOrder, chainId),
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
    const {
        currency,
        language,
        confirmationMode,
        launchAccount,
        accountOrder,
    } = settings

    if (currency) {
        useCurrenciesStore.getState().setCurrencyPreference({
            preferredCurrency: currency.preferred,
            fallbackCurrency: currency.fallback,
        })
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
    if (accountOrder) {
        if (isAccountSortMode(accountOrder.mode)) {
            useAccountsStore.getState().setSortMode(accountOrder.mode)
        }
        applyAccountOrder(accountOrder.addresses)
    }
}

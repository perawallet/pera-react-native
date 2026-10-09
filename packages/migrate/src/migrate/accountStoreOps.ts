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
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import type { MigratedAccountPair } from './types'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

/** The address a migrated account holds on the chain Pera 6 data belongs to. */
export const migratedAddressOf = (
    account: WalletAccount,
    chainId: ChainId,
): string | undefined => chainAccountOf(account, chainId)?.address

export const addKeylessAccountToStore = (
    account: WalletAccount,
): WalletAccount => {
    const store = useAccountsStore.getState()
    store.setAccounts([...store.accounts, account])
    return account
}

export const applyAllLegacyMetadata = (
    pairs: MigratedAccountPair[],
    chainId: ChainId,
): void => {
    if (pairs.length === 0) return

    // By address, not id: the store's dedupe may have kept another record for
    // the same address over the one the import returned.
    const legacyByAddress = new Map(
        pairs.map(({ created, legacy }) => [
            migratedAddressOf(created, chainId),
            legacy,
        ]),
    )

    const store = useAccountsStore.getState()
    let changed = false
    const next = store.accounts.map(account => {
        const address = migratedAddressOf(account, chainId)
        const legacy =
            address !== undefined ? legacyByAddress.get(address) : undefined
        if (!legacy) return account

        const name = legacy.name || account.name
        if (account.name === name) return account

        changed = true
        return { ...account, name }
    })

    if (changed) store.setAccounts(next)
}

export const markLegacyBackedUpAccounts = (
    pairs: MigratedAccountPair[],
    markAccountBackedUp?: (account: WalletAccount) => void,
): void => {
    if (!markAccountBackedUp) return
    for (const { created, legacy } of pairs) {
        if (legacy.isBackedUp) markAccountBackedUp(created)
    }
}

export const removeAccountFromStore = (id: string): void => {
    const store = useAccountsStore.getState()
    store.setAccounts(store.accounts.filter(a => a.id !== id))
}

export const applyRekeyAddressToStoreAccount = (
    address: string,
    authAddress: string,
    chainId: ChainId,
): void => {
    const store = useAccountsStore.getState()
    store.setAccounts(
        store.accounts.map(a =>
            migratedAddressOf(a, chainId) === address
                ? { ...a, rekeyAddress: authAddress }
                : a,
        ),
    )
}

export const applyLegacyAccountOrder = (
    legacyAccounts: LegacyAccount[],
    chainId: ChainId,
): void => {
    const orderByAddress = new Map(
        legacyAccounts
            .filter(a => a.preferredOrder >= 0)
            .map(a => [a.address, a.preferredOrder] as const),
    )
    if (orderByAddress.size === 0) return

    const orderOf = (account: WalletAccount): number => {
        const address = migratedAddressOf(account, chainId)
        return (
            (address !== undefined ? orderByAddress.get(address) : undefined) ??
            Number.POSITIVE_INFINITY
        )
    }

    const store = useAccountsStore.getState()
    const sorted = [...store.accounts]
        .sort((a, b) => orderOf(a) - orderOf(b))
        .map(a => a.id)

    store.setManualAccountOrder(sorted)
}

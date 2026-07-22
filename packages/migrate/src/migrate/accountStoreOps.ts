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
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import type { MigratedAccountPair } from './types'

export const addKeylessAccountToStore = (
    account: WalletAccount,
): WalletAccount => {
    const store = useAccountsStore.getState()
    store.setAccounts([...store.accounts, account])
    return account
}

export const applyAllLegacyMetadata = (pairs: MigratedAccountPair[]): void => {
    if (pairs.length === 0) return

    const legacyByAddress = new Map(
        pairs.map(({ created, legacy }) => [created.address, legacy]),
    )

    const store = useAccountsStore.getState()
    let changed = false
    const next = store.accounts.map(account => {
        const legacy = legacyByAddress.get(account.address)
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

export const removeAccountFromStore = (address: string): void => {
    const store = useAccountsStore.getState()
    store.setAccounts(store.accounts.filter(a => a.address !== address))
}

export const applyRekeyAddressToStoreAccount = (
    address: string,
    authAddress: string,
): void => {
    const store = useAccountsStore.getState()
    store.setAccounts(
        store.accounts.map(a =>
            a.address === address ? { ...a, rekeyAddress: authAddress } : a,
        ),
    )
}

export const applyLegacyAccountOrder = (
    legacyAccounts: LegacyAccount[],
): void => {
    const orderByAddress = new Map(
        legacyAccounts
            .filter(a => a.preferredOrder >= 0)
            .map(a => [a.address, a.preferredOrder] as const),
    )
    if (orderByAddress.size === 0) return

    const store = useAccountsStore.getState()
    const sorted = [...store.accounts]
        .sort((a, b) => {
            const ao = orderByAddress.get(a.address) ?? Number.POSITIVE_INFINITY
            const bo = orderByAddress.get(b.address) ?? Number.POSITIVE_INFINITY
            return ao - bo
        })
        .map(a => a.address)

    store.setManualAccountOrder(sorted)
}

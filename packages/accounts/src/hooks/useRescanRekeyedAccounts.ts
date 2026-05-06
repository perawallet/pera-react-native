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

import { useCallback, useMemo } from 'react'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { fetchRekeyedAddresses } from '../account-discovery'
import { AccountTypes, type WatchAccount } from '../models'
import { useAccountsStore } from '../store'

export type RekeyedScanResult = {
    /** Accounts the indexer reports are rekeyed to `sourceAddress` AND are
     * already in the wallet (added previously). Surfaced for context only. */
    importedAddresses: string[]
    /** Rekeyed accounts not yet in the wallet — candidates for import. */
    notImportedAddresses: string[]
}

export type UseRescanRekeyedAccountsResult = {
    /** Hits the indexer for every account whose auth-addr is `sourceAddress`. */
    scan: (sourceAddress: string) => Promise<RekeyedScanResult>
    /** Persists the chosen addresses as watch accounts whose rekeyAddress
     *  points at `sourceAddress`. Mirrors Android's `addNewAccount` call
     *  with `Type.NoAuth, creationType = REKEYED`. */
    importSelected: (
        sourceAddress: string,
        addresses: string[],
    ) => Promise<void>
}

export const useRescanRekeyedAccounts = (): UseRescanRekeyedAccountsResult => {
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)

    const localAddresses = useMemo(
        () => new Set(accounts.map(a => a.address)),
        [accounts],
    )

    const scan = useCallback(
        async (sourceAddress: string): Promise<RekeyedScanResult> => {
            const addresses = await fetchRekeyedAddresses(sourceAddress)
            const imported: string[] = []
            const notImported: string[] = []
            for (const addr of addresses) {
                if (localAddresses.has(addr)) {
                    imported.push(addr)
                } else {
                    notImported.push(addr)
                }
            }
            return {
                importedAddresses: imported,
                notImportedAddresses: notImported,
            }
        },
        [localAddresses],
    )

    const importSelected = useCallback(
        async (sourceAddress: string, addresses: string[]): Promise<void> => {
            if (addresses.length === 0) return

            const watchAccounts: WatchAccount[] = addresses
                // Defensive: never re-add an address that already exists,
                // and reject anything that doesn't validate as an Algorand
                // address — the indexer is a remote dependency and a typo
                // / compromise should never persist garbage to the store.
                .filter(
                    addr =>
                        isValidAlgorandAddress(addr) &&
                        !localAddresses.has(addr),
                )
                .map(address => ({
                    id: generateOrderedUniqueId(),
                    address,
                    type: AccountTypes.watch,
                    rekeyAddress: sourceAddress,
                }))

            if (watchAccounts.length === 0) return

            // Read the freshest state from the store (the closure-captured
            // `accounts` may be stale by the time we get here) and append
            // immediately. `getState()` and `setAccounts()` are both
            // synchronous, and React Native's JS runtime is single-threaded —
            // nothing else can interleave between these two lines, so this
            // is atomic by construction. No CAS / versioning needed.
            const current = useAccountsStore.getState().accounts
            setAccounts([...current, ...watchAccounts])
        },
        [localAddresses, setAccounts],
    )

    return { scan, importSelected }
}

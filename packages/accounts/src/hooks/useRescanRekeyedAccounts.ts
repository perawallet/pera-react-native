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

import { useCallback } from 'react'
import {
    isValidAlgorandAddress,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { fetchRekeyedAddresses } from '../account-discovery'
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
     *  with `Type.NoAuth, creationType = REKEYED`. Resolves with the number
     *  of accounts actually persisted — 0 when every address was invalid or
     *  already in the wallet — so callers can react accordingly. */
    importSelected: (
        sourceAddress: string,
        addresses: string[],
    ) => Promise<number>
}

export const useRescanRekeyedAccounts = (): UseRescanRekeyedAccountsResult => {
    const addRekeyedWatchAccounts = useAccountsStore(
        state => state.addRekeyedWatchAccounts,
    )
    const { network } = useNetwork()

    const scan = useCallback(
        async (sourceAddress: string): Promise<RekeyedScanResult> => {
            const addresses = await fetchRekeyedAddresses(
                sourceAddress,
                network,
            )
            // Read the wallet's account set fresh, after the indexer call —
            // a scan can outlive an import/add that lands while the request
            // is in flight, so classification must reflect the latest store
            // rather than a render-time snapshot.
            const localAddresses = new Set(
                useAccountsStore.getState().accounts.map(a => a.address),
            )
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
        [network],
    )

    const importSelected = useCallback(
        async (sourceAddress: string, addresses: string[]): Promise<number> => {
            if (addresses.length === 0) return 0

            // Format-validate only — we trust the indexer's auth-addr filter
            // (`fetchRekeyedAddresses` queries by `auth-addr: sourceAddress`)
            // to bound which addresses come back. We do NOT re-derive the
            // on-chain auth relationship before persisting: if the indexer
            // is wrong about the auth-addr we'd import a watch-only entry
            // that doesn't actually sign through `sourceAddress`. The next
            // sync corrects classification, but the address stays imported.
            // Acceptable trade-off for now; revisit if indexer trust changes.
            const valid = addresses.filter(isValidAlgorandAddress)
            if (valid.length === 0) return 0

            return addRekeyedWatchAccounts(sourceAddress, valid, network)
        },
        [addRekeyedWatchAccounts, network],
    )

    return { scan, importSelected }
}

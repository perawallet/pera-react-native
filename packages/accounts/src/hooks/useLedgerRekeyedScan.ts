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

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { HardwareWalletDerivedAccount } from '@perawallet/wallet-core-hardware-wallet'
import { fetchRekeyedAddresses } from '../account-discovery'
import { getRekeyedAddressesQueryKey } from './querykeys'
import { useAllAccounts } from './useAllAccounts'
import type { LedgerSelectableAccount } from '../models'

type UseLedgerRekeyedScanResult = {
    rekeyed: LedgerSelectableAccount[]
    isScanning: boolean
}

/**
 * For each discovered Ledger (derived) account, scans the indexer for accounts
 * rekeyed to it and returns them as `rekeyed` selectables.
 *
 * Shares the `rekeyed-addresses` query key with `prefetchLedgerAccountPreview`
 * so a prior prefetch supplies an immediate first value. A small `staleTime`
 * lets the prefetch actually pay off across this short-lived import session;
 * rescan flows invalidate the cache when fresher data is explicitly required.
 * Best-effort: a failed/empty scan yields no rows for that address.
 */
export const useLedgerRekeyedScan = (
    derivedAccounts: HardwareWalletDerivedAccount[],
): UseLedgerRekeyedScanResult => {
    const { network } = useNetwork()
    const allAccounts = useAllAccounts()

    const results = useQueries({
        queries: derivedAccounts.map(acc => ({
            queryKey: getRekeyedAddressesQueryKey(acc.address, network),
            queryFn: () => fetchRekeyedAddresses(acc.address, network),
            staleTime: 30_000,
        })),
    })

    // `useQueries` returns a fresh `results` array on every render even when
    // nothing changed, so depending on it directly defeats memoization. This
    // primitive signature captures everything the body actually reads, and
    // Object.is stays true across renders when content matches — so the
    // useMemo below skips recomputation until a query result actually moves.
    const resultsSig = results
        .map(
            (r, i) =>
                `${derivedAccounts[i]?.address ?? ''}|${
                    r.isPending ? 1 : 0
                }|${(r.data ?? []).join(',')}`,
        )
        .join('||')

    return useMemo(() => {
        const derivedAddresses = new Set(derivedAccounts.map(a => a.address))
        const importedAddresses = new Set(allAccounts.map(a => a.address))
        const seen = new Set<string>()
        const rekeyed: LedgerSelectableAccount[] = []

        results.forEach((res, idx) => {
            const authAccount = derivedAccounts[idx]
            if (!authAccount) return
            const addresses: string[] = res.data ?? []
            for (const address of addresses) {
                if (
                    derivedAddresses.has(address) ||
                    importedAddresses.has(address) ||
                    seen.has(address)
                ) {
                    continue
                }
                seen.add(address)
                rekeyed.push({ kind: 'rekeyed', address, authAccount })
            }
        })

        const isScanning = results.some(r => r.isPending)
        return { rekeyed, isScanning }
        // `resultsSig` encodes everything we read from `results`; depending
        // on `results` itself would force a re-compute every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultsSig, derivedAccounts, allAccounts])
}

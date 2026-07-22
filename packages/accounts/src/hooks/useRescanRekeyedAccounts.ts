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
import { logger } from '@perawallet/wallet-core-shared'
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

export type RekeyedSweepCandidate = {
    address: string
    /** The wallet key the candidate is rekeyed to (its on-chain auth-addr). */
    sourceAddress: string
}

export type RekeyedSweepResult = {
    importedAddresses: string[]
    candidates: RekeyedSweepCandidate[]
    /** Keys whose indexer scan failed — a partial sweep, not a void one. */
    failedSources: string[]
}

export type ScanAllOptions = {
    /** Called after each key settles (success or failure). */
    onProgress?: (scanned: number, total: number) => void
}

/** Indexer calls in flight at once during a sweep. */
const SWEEP_CONCURRENCY = 4

export type UseRescanRekeyedAccountsResult = {
    /** Hits the indexer for every account whose auth-addr is `sourceAddress`. */
    scan: (sourceAddress: string) => Promise<RekeyedScanResult>
    /**
     * Sweeps every given wallet key with the same auth-addr query, with
     * bounded concurrency. One key's failure doesn't void the sweep —
     * failed keys are reported so the UI can surface a partial-failure
     * notice.
     */
    scanAll: (
        sourceAddresses: string[],
        options?: ScanAllOptions,
    ) => Promise<RekeyedSweepResult>
    /** Persists the chosen addresses as watch accounts whose rekeyAddress
     *  points at `sourceAddress`. Mirrors Android's `addNewAccount` call
     *  with `Type.NoAuth, creationType = REKEYED`. Resolves with the number
     *  of accounts actually persisted — 0 when every address was invalid or
     *  already in the wallet — so callers can react accordingly. */
    importSelected: (
        sourceAddress: string,
        addresses: string[],
    ) => Promise<number>
    /** Sweep counterpart of `importSelected`: each candidate is persisted
     *  against its own source key. */
    importFromSweep: (candidates: RekeyedSweepCandidate[]) => Promise<number>
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

    const scanAll = useCallback(
        async (
            sourceAddresses: string[],
            options?: ScanAllOptions,
        ): Promise<RekeyedSweepResult> => {
            const sources = Array.from(new Set(sourceAddresses))
            const total = sources.length
            let settled = 0
            const foundBySource = new Map<string, string[]>()
            const failedSources: string[] = []

            // Bounded fan-out so a many-key wallet doesn't fire dozens of
            // indexer calls at once.
            for (let i = 0; i < sources.length; i += SWEEP_CONCURRENCY) {
                const chunk = sources.slice(i, i + SWEEP_CONCURRENCY)
                await Promise.all(
                    chunk.map(async source => {
                        try {
                            foundBySource.set(
                                source,
                                await fetchRekeyedAddresses(source, network),
                            )
                        } catch (error) {
                            // One key's indexer failure must not void the
                            // sweep — record it and keep going.
                            logger.warn(
                                'Rekeyed sweep: scan failed for a source key',
                                { source, error },
                            )
                            failedSources.push(source)
                        } finally {
                            settled += 1
                            options?.onProgress?.(settled, total)
                        }
                    }),
                )
            }

            // Same rationale as `scan`: classify against the store as it is
            // AFTER the last indexer call, not a render-time snapshot.
            const localAddresses = new Set(
                useAccountsStore.getState().accounts.map(a => a.address),
            )
            const imported = new Set<string>()
            const candidateSource = new Map<string, string>()
            for (const source of sources) {
                const found = foundBySource.get(source)
                if (!found) continue
                for (const address of found) {
                    if (localAddresses.has(address)) {
                        imported.add(address)
                        continue
                    }
                    // An account has one auth-addr, so a candidate should
                    // only ever surface under one key — first hit wins.
                    if (!candidateSource.has(address)) {
                        candidateSource.set(address, source)
                    }
                }
            }

            return {
                importedAddresses: Array.from(imported),
                candidates: Array.from(
                    candidateSource,
                    ([address, sourceAddress]) => ({ address, sourceAddress }),
                ),
                failedSources,
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

    const importFromSweep = useCallback(
        async (candidates: RekeyedSweepCandidate[]): Promise<number> => {
            const bySource = new Map<string, string[]>()
            for (const candidate of candidates) {
                const group = bySource.get(candidate.sourceAddress) ?? []
                group.push(candidate.address)
                bySource.set(candidate.sourceAddress, group)
            }

            let count = 0
            for (const [sourceAddress, addresses] of bySource) {
                count += await importSelected(sourceAddress, addresses)
            }
            return count
        },
        [importSelected],
    )

    return { scan, scanAll, importSelected, importFromSweep }
}

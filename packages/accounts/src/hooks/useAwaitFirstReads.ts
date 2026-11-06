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

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import {
    readRemoteConfigWithOverrides,
    RemoteConfigKeys,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { timeoutErrorOf, withTimeout } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AccountHoldingSource } from '../db'
import { useHoldingsRefreshStore } from '../store/holdingsRefresh'
import { ensureAccountFetched } from '../sync/account-syncer'
import {
    invalidateAccountListQueriesForAddresses,
    type AccountListQueryKind,
} from './querykeys'

// Milliseconds. Kept here, not read from the platform defaults map: an entry
// missing there would come back as NaN, and a NaN timer fires at once.
const FALLBACK_WAIT_MS = 3000

/** Milliseconds; an unusable remote value falls back to the bundled one. */
export const readFirstReadWaitMs = (): number => {
    const value = readRemoteConfigWithOverrides(
        getProvider().remoteConfig,
        useRemoteConfigStore.getState().configOverrides,
    ).getNumberValue(
        RemoteConfigKeys.account_list_first_read_wait_ms,
        FALLBACK_WAIT_MS,
    )
    return Number.isFinite(value) && value > 0 ? value : FALLBACK_WAIT_MS
}

// A background read that rejects has nothing to re-read; the next list read
// asks again.
const ignoreRejection = (): void => undefined

const isReadFailed = ({ address, scope }: AccountHoldingSource): boolean =>
    useHoldingsRefreshStore.getState().failed[toScopeKey(scope)]?.[address] ===
    true

export type AwaitFirstReads = (
    sources: readonly AccountHoldingSource[],
) => Promise<void>

/**
 * Self-heals a freshly imported or selected account the background sync
 * hasn't populated yet, for a list that reads SQLite whole. The list waits on
 * each chain's first read for a bounded time only, so one slow chain can't
 * hold every other chain's rows behind it; a read that lands later re-reads
 * this kind of list alone.
 */
export const useAwaitFirstReads = (
    kind: AccountListQueryKind,
): AwaitFirstReads => {
    const queryClient = useQueryClient()
    // Failed chains that already re-read the list once on this mount.
    const refreshedAfterFailure = useRef(new Set<string>())

    return useCallback(
        async sources => {
            const refresh = (address: string) =>
                invalidateAccountListQueriesForAddresses(queryClient, kind, [
                    address,
                ])
            const waitMs = readFirstReadWaitMs()
            await Promise.all(
                sources.map(source => {
                    const fetched = ensureAccountFetched(
                        source.address,
                        source.scope,
                    )
                    // Asked again without the list waiting on it. It re-reads
                    // the list when a read succeeds, and once otherwise to show
                    // its placeholder row, so a chain that stays down can't loop.
                    if (isReadFailed(source)) {
                        const key = `${toScopeKey(source.scope)}|${source.address}`
                        void fetched.then(() => {
                            if (!isReadFailed(source)) {
                                refreshedAfterFailure.current.delete(key)
                                refresh(source.address)
                            } else if (
                                !refreshedAfterFailure.current.has(key)
                            ) {
                                refreshedAfterFailure.current.add(key)
                                refresh(source.address)
                            }
                        }, ignoreRejection)
                        return undefined
                    }
                    // Only the deadline is swallowed: the read can still reject
                    // (its state-row lookup is outside its own catch), and that
                    // fails the list as before.
                    const deadline = timeoutErrorOf('First account read', waitMs)
                    return withTimeout(
                        fetched,
                        waitMs,
                        'First account read',
                        () => deadline,
                    ).catch((error: unknown) => {
                        if (error !== deadline) throw error
                        void fetched.then(
                            () => refresh(source.address),
                            ignoreRejection,
                        )
                    })
                }),
            )
        },
        [queryClient, kind],
    )
}

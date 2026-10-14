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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    CHAIN_IDS,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useSyncCursorStore } from '../polling'
import type { AccountChainAddress, SyncStorePorts } from '../models'

const cursorFor = (scope: ChainScope) =>
    useSyncCursorStore.getState().cursors[toScopeKey(scope)]

export const createSyncStorePorts = (): SyncStorePorts => ({
    // Walks the known chain ids rather than the record's keys: a key this
    // build doesn't know (a record from a newer build) has no scope to sync.
    getAccountChainAddresses: () =>
        useAccountsStore.getState().accounts.flatMap(account =>
            CHAIN_IDS.flatMap((chainId): AccountChainAddress[] => {
                const address = account.chains[chainId]?.address
                return address === undefined ? [] : [{ chainId, address }]
            }),
        ),
    getSelectedScope,
    // The persisted map can be partial, and an absent key must read as
    // never-synced (null), not as undefined — which `!== null` would treat
    // as already synced and skip the force-sync.
    getChangeCursor: scope => cursorFor(scope)?.refreshRound ?? null,
    setChangeCursor: (scope, cursor) =>
        useSyncCursorStore.getState().setRefreshRound(scope, cursor),
    getLastSyncAt: (scope, kind) => {
        const cursor = cursorFor(scope)
        return (
            (kind === 'assets'
                ? cursor?.lastAssetSyncAt
                : cursor?.lastPriceSyncAt) ?? null
        )
    },
    setLastSyncAt: (scope, kind, atMs) =>
        useSyncCursorStore.getState().markSynced(scope, kind, atMs),
})

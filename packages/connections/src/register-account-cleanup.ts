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
    whenAccountsHydrationSettled,
} from '@perawallet/wallet-core-accounts'
import {
    logger,
    registerAccountCleanup,
    type AccountCleanupContext,
} from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import {
    getActiveConnectionRegistry,
    getActiveConnectionStore,
} from './activeRegistry'
import type { ConnectionRegistryClient } from './registry'

export const isConnectionRevokedForAccountRemoval = ({
    accounts,
    createdAt,
}: Pick<Connection, 'accounts' | 'createdAt'>): boolean => {
    const revokedThrough = useAccountsStore.getState().connectionRevokedThrough
    return accounts.some(address => {
        const cutoff = revokedThrough?.[address.toLowerCase()]
        return typeof cutoff === 'number' && createdAt <= cutoff
    })
}

const isWalletConnect = ({ kind }: Connection): boolean =>
    kind === 'walletconnect-v1' || kind === 'walletconnect-v2'

/**
 * Disconnects every connection holding a removed account, so re-importing the
 * address never brings its sessions back without a fresh approval. The whole
 * session goes: not every protocol can drop one account from a live session.
 * EVM addresses are compared case-insensitively, as checksum casing varies.
 */
export const disconnectConnectionsForAccount = async ({
    accountAddress,
}: AccountCleanupContext): Promise<void> => {
    const registry = getActiveConnectionRegistry()
    const store = getActiveConnectionStore()
    if (!registry || !store) return
    const removed = accountAddress.toLowerCase()
    const cutoff =
        useAccountsStore.getState().connectionRevokedThrough?.[removed]
    const holding = (await store.list()).filter(({ accounts }) =>
        accounts.some(account => account.toLowerCase() === removed),
    )
    await Promise.all(
        holding
            .filter(
                connection =>
                    !isWalletConnect(connection) ||
                    cutoff === undefined ||
                    connection.createdAt <= cutoff,
            )
            .map(({ id }) => registry.disconnect(id)),
    )
}

registerAccountCleanup(disconnectConnectionsForAccount)

// Before rehydration the revocation map is empty, which reads as nothing revoked.
export const waitForAccountsHydration = (): Promise<void> =>
    new Promise(resolve => {
        if (useAccountsStore.persist.hasHydrated()) {
            resolve()
            return
        }
        const unsubscribe = useAccountsStore.persist.onFinishHydration(() => {
            unsubscribe()
            resolve()
        })
        void whenAccountsHydrationSettled().then(() => {
            unsubscribe()
            resolve()
        })
    })

/**
 * Disconnects every connection granted before one of its addresses was
 * removed: a removal whose cleanup never ran (a crash, a failed step) must not
 * leave a session that re-importing the address would bring back. Driven by
 * the recorded removals only, so a partial account list revokes nothing.
 */
export const disconnectConnectionsOfRemovedAccounts = async (
    registry: Pick<ConnectionRegistryClient, 'disconnect'>,
    store: Pick<ConnectionStoreAPI, 'list'>,
): Promise<void> => {
    await waitForAccountsHydration()
    const orphaned = (await store.list()).filter(
        isConnectionRevokedForAccountRemoval,
    )
    const results = await Promise.allSettled(
        orphaned.map(({ id }) => registry.disconnect(id)),
    )
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.warn(
                '[connections] disconnecting a removed account failed',
                {
                    connectionId: orphaned[index].id,
                    error: result.reason,
                },
            )
        }
    })
}

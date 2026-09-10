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

import { logger } from '@perawallet/wallet-core-shared'
import type {
    ConnectionOrigin,
    ConnectionOriginSource,
    ConnectionPeer,
    ConnectionPersistence,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { isAlgorandPermission } from '../models'
import { toPeer } from '../shared/peer'
import { readString } from '../shared/read'
import {
    WALLET_CONNECT_V1_KIND,
    type WalletConnectV1Connection,
} from '../v1/connection'
import {
    createKeystoreSessionKeyStore,
    type WalletConnectV1SessionKeyStore,
} from '../v1/secrets'

export const LEGACY_STORE_KEY = 'wallet-connect-store'

/**
 * Ids already imported. The blob is retained until every key verifies, so
 * without this a record the user disconnected after an earlier pass comes back
 * `active` on the next launch — the live store alone cannot tell "never
 * imported" from "imported and since removed".
 */
export const LEGACY_IMPORTED_IDS_KEY = 'wallet-connect-store:imported'

// The v1 client derives its AES key from this hex; anything else can never
// decrypt a frame, so committing it would only preserve an unrevivable session.
const SESSION_KEY_PATTERN = /^[0-9a-f]{64}$/i

type ReconstructedLegacySession = {
    clientId: string
    sessionKey: string
    bridge: string
    peerId: string
    handshakeTopic: string
    chainId: number
    accounts: string[]
    handshakeId?: number
    permissions?: string[]
    peer: ConnectionPeer
    createdAt: number
    lastActiveAt: number
}

// `null`, never a throw, for anything unrecoverable: one malformed row must not abort the run.
const reconstructRecord = (
    record: unknown,
): ReconstructedLegacySession | null => {
    if (typeof record !== 'object' || record === null) return null
    const top = record as Record<string, unknown>

    const clientId = readString(top, 'clientId')
    if (!clientId) return null

    const sessionValue = top.session
    if (typeof sessionValue !== 'object' || sessionValue === null) return null
    const session = sessionValue as Record<string, unknown>

    const sessionKey = readString(session, 'key')
    if (!sessionKey || !SESSION_KEY_PATTERN.test(sessionKey)) return null

    const bridge = readString(session, 'bridge') ?? readString(top, 'bridge')
    if (!bridge) return null

    const peerId = readString(session, 'peerId')
    if (!peerId) return null

    const handshakeTopic = readString(session, 'handshakeTopic')
    if (!handshakeTopic) return null

    const chainId = session.chainId
    if (typeof chainId !== 'number') return null

    const accountsValue = session.accounts
    if (!Array.isArray(accountsValue)) return null
    const accounts = accountsValue.filter(
        (value): value is string => typeof value === 'string',
    )
    if (accounts.length === 0) return null

    const handshakeIdValue = session.handshakeId
    const handshakeId =
        typeof handshakeIdValue === 'number' ? handshakeIdValue : undefined

    // The legacy record stamps approved permissions onto `session`; carrying
    // them keeps the settings permissions panel from going blank.
    const permissionsValue = session.permissions
    const permissions = Array.isArray(permissionsValue)
        ? permissionsValue
              .filter((value): value is string => typeof value === 'string')
              .filter(isAlgorandPermission)
        : undefined

    const createdAtValue = top.createdAt
    const parsedCreatedAt =
        typeof createdAtValue === 'string' ? Date.parse(createdAtValue) : NaN
    const createdAt = Number.isFinite(parsedCreatedAt)
        ? parsedCreatedAt
        : Date.now()

    // Settings sorts on `lastActiveAt`; defaulting it would re-sort the list.
    // Both timestamps are ISO strings on the blob (`createJSONStorage` has no `Date` reviver).
    const lastActiveAtValue = top.lastActiveAt
    const parsedLastActiveAt =
        typeof lastActiveAtValue === 'string'
            ? Date.parse(lastActiveAtValue)
            : NaN
    const lastActiveAt = Number.isFinite(parsedLastActiveAt)
        ? parsedLastActiveAt
        : createdAt

    return {
        clientId,
        sessionKey,
        bridge,
        peerId,
        handshakeTopic,
        chainId,
        accounts,
        handshakeId,
        permissions,
        peer: toPeer(session.peerMeta),
        createdAt,
        lastActiveAt,
    }
}

type LegacyState = {
    records: unknown[]
    /** Raw `state.dappOrigins`; validated per-entry by `reconstructOrigin`. */
    dappOrigins: unknown
}

// `null` means "shape not understood", which the caller must treat like
// unparseable JSON: keep the blob. An empty records array is understood.
const readLegacyState = (parsed: unknown): LegacyState | null => {
    if (typeof parsed !== 'object' || parsed === null) return null
    const state = (parsed as { state?: unknown }).state
    if (typeof state !== 'object' || state === null) return null
    const records = (state as { walletConnectConnections?: unknown })
        .walletConnectConnections
    if (!Array.isArray(records)) return null
    const dappOrigins = (state as { dappOrigins?: unknown }).dappOrigins
    return { records, dappOrigins }
}

const ORIGIN_SOURCES: readonly ConnectionOriginSource[] = [
    'external-browser',
    'in-app',
    'qr',
]

// Missing or malformed is `undefined`, not a reason to skip the record: the
// connection just loses the "Return to the dApp" hand-off.
const reconstructOrigin = (value: unknown): ConnectionOrigin | undefined => {
    if (typeof value !== 'object' || value === null) return undefined
    const raw = value as Record<string, unknown>
    const source = raw.source
    if (
        typeof source !== 'string' ||
        !ORIGIN_SOURCES.includes(source as ConnectionOriginSource)
    ) {
        return undefined
    }
    const browserName = readString(raw, 'browserName')

    return {
        source: source as ConnectionOriginSource,
        ...(browserName ? { browserName } : {}),
    }
}

const readImportedIds = (storage: ConnectionPersistence): Set<string> => {
    const raw = storage.getItem(LEGACY_IMPORTED_IDS_KEY)
    if (raw === null) return new Set()
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return new Set()
        return new Set(
            parsed.filter(
                (value): value is string => typeof value === 'string',
            ),
        )
    } catch {
        // A corrupt marker only costs one redundant import pass.
        return new Set()
    }
}

const originFor = (
    dappOrigins: unknown,
    clientId: string,
): ConnectionOrigin | undefined => {
    if (typeof dappOrigins !== 'object' || dappOrigins === null) {
        return undefined
    }
    return reconstructOrigin((dappOrigins as Record<string, unknown>)[clientId])
}

/**
 * The blob is the sole copy of every key, so deleting it is the last step and
 * every step before it is idempotent; a re-run after a crash converges. Must run
 * after keystore hydration: `has` answers `false`, not "wait", before it.
 */
export const importLegacyConnections = async (options: {
    storage: ConnectionPersistence
    store: ConnectionStoreAPI
    sessionKeys?: WalletConnectV1SessionKeyStore
}): Promise<{ imported: number; skipped: number }> => {
    const { storage, store } = options
    const sessionKeys = options.sessionKeys ?? createKeystoreSessionKeyStore()

    // Read raw: instantiating the legacy zustand store would re-persist the plaintext keys.
    const raw = storage.getItem(LEGACY_STORE_KEY)
    if (raw === null) return { imported: 0, skipped: 0 }

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (error) {
        logger.warn(
            '[WC migration] legacy connect-store blob is not valid JSON; leaving it in place',
            { error },
        )
        return { imported: 0, skipped: 0 }
    }

    const legacyState = readLegacyState(parsed)
    if (!legacyState) {
        logger.warn(
            '[WC migration] legacy connect-store blob has an unrecognized shape; leaving it in place',
        )
        return { imported: 0, skipped: 0 }
    }
    const { records, dappOrigins } = legacyState

    let imported = 0
    let skipped = 0
    // A record that throws is unattempted, not skipped; caught so one
    // permanently failing record cannot strand every record after it.
    let unattempted = 0
    let firstFailure: Error | null = null
    const committedClientIds: string[] = []
    const presentIds = new Set((await store.list()).map(({ id }) => id))
    const importedIds = readImportedIds(storage)
    // Written per record, not once at the end: a crash between two records
    // must not leave an already-imported session unmarked and re-importable.
    const markImported = (clientId: string): void => {
        if (importedIds.has(clientId)) return
        importedIds.add(clientId)
        storage.setItem(
            LEGACY_IMPORTED_IDS_KEY,
            JSON.stringify([...importedIds]),
        )
    }

    for (const record of records) {
        const reconstructed = reconstructRecord(record)
        if (!reconstructed) {
            skipped += 1
            continue
        }

        try {
            // Imported earlier and since disconnected: `disconnect` released
            // its key, so committing again would recreate a secret no record
            // points at, and gating the blob on it would keep the blob forever.
            if (
                importedIds.has(reconstructed.clientId) &&
                !presentIds.has(reconstructed.clientId)
            ) {
                skipped += 1
                continue
            }

            const secretRef = await sessionKeys.commit(
                reconstructed.clientId,
                reconstructed.sessionKey,
            )

            // Already in the store from an earlier pass. Its key is still
            // verified below before the blob may go.
            if (presentIds.has(reconstructed.clientId)) {
                skipped += 1
                committedClientIds.push(reconstructed.clientId)
                markImported(reconstructed.clientId)
                continue
            }

            const origin = originFor(dappOrigins, reconstructed.clientId)
            const connection: WalletConnectV1Connection = {
                id: reconstructed.clientId,
                kind: WALLET_CONNECT_V1_KIND,
                name: reconstructed.peer.name,
                peer: reconstructed.peer,
                accounts: reconstructed.accounts,
                secretRef,
                status: 'active',
                createdAt: reconstructed.createdAt,
                lastActiveAt: reconstructed.lastActiveAt,
                metadata: {
                    bridge: reconstructed.bridge,
                    handshakeTopic: reconstructed.handshakeTopic,
                    peerId: reconstructed.peerId,
                    chainId: reconstructed.chainId,
                    ...(reconstructed.handshakeId !== undefined
                        ? { handshakeId: reconstructed.handshakeId }
                        : {}),
                    ...(reconstructed.permissions
                        ? { permissions: reconstructed.permissions }
                        : {}),
                },
                ...(origin ? { origin } : {}),
            }
            await store.upsert(connection)
            presentIds.add(connection.id)
            markImported(connection.id)

            imported += 1
            committedClientIds.push(reconstructed.clientId)
        } catch (error) {
            unattempted += 1
            firstFailure ??=
                error instanceof Error ? error : new Error(String(error))
            logger.warn(
                '[WC migration] failed to import a legacy session; it and its key remain for the next run',
                { clientId: reconstructed.clientId, error },
            )
        }
    }

    // Deletion is gated on every committed key reading back, not on zero
    // skips: a permanently malformed row must not keep the plaintext blob on
    // disk forever, but a lost key must. A real read, not a presence check —
    // an entry that exists but cannot be decrypted is a lost key.
    const readBacks = await Promise.all(
        committedClientIds.map(async clientId => {
            try {
                // Collapsed to a boolean here, never carried: the verification
                // must not leave a copy of every session key in an array.
                const key = await sessionKeys.read(clientId)
                return { clientId, readable: key !== null }
            } catch (error) {
                logger.warn('[WC migration] session key failed to read back', {
                    clientId,
                    error,
                })
                return { clientId, readable: false }
            }
        }),
    )
    const unverified = readBacks
        .filter(({ readable }) => !readable)
        .map(({ clientId }) => clientId)
    if (unverified.length > 0) {
        logger.warn(
            '[WC migration] some migrated session keys failed verification; keeping the legacy blob',
            { unverified },
        )
    }

    if (unattempted > 0 || unverified.length > 0) {
        // Rethrown only after every record got its attempt this pass.
        if (firstFailure) throw firstFailure
        return { imported, skipped }
    }

    storage.removeItem(LEGACY_STORE_KEY)
    // The blob is gone, so the marker has nothing left to guard.
    storage.removeItem(LEGACY_IMPORTED_IDS_KEY)
    storage.trim?.()

    return { imported, skipped }
}

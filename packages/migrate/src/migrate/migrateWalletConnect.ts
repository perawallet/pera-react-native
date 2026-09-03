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
import type { LegacyWalletConnectV1Session } from '@perawallet/wallet-extension-platform'
import {
    ALL_PERMISSIONS,
    commitSessionKey,
    isWalletConnectV1Connection,
    toPeer,
    type WalletConnectV1Connection,
} from '@perawallet/wallet-core-walletconnect'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type WalletConnectMigrationResult = {
    imported: number
    skipped: number
}

/**
 * Android exports `date_time_stamp` (epoch seconds) under the `dateTimestampMs`
 * name — apply the same seconds-vs-ms guard the passkey model uses.
 */
const normalizeTimestampMs = (value: number): number =>
    value > 0 && value < 10_000_000_000 ? value * 1000 : value

type ParsedSessionMeta = {
    bridge: string | null
    key: string | null
    topic: string | null
}

const parseSessionMeta = (json: string): ParsedSessionMeta => {
    try {
        const parsed: unknown = JSON.parse(json)
        if (parsed === null || typeof parsed !== 'object') {
            return { bridge: null, key: null, topic: null }
        }
        const meta = parsed as Record<string, unknown>
        return {
            bridge: typeof meta.bridge === 'string' ? meta.bridge : null,
            key: typeof meta.key === 'string' ? meta.key : null,
            topic: typeof meta.topic === 'string' ? meta.topic : null,
        }
    } catch {
        return { bridge: null, key: null, topic: null }
    }
}

/**
 * A legacy record reconstructed and validated, ready to become a
 * `WalletConnectV1Connection` once its session key has been committed to the
 * keystore. No secret material lives past this point without a
 * `secretRef` — `key` here is the raw session key, held only long enough to
 * hand to `commitSessionKey`.
 */
type ReconstructedLegacySession = {
    clientId: string
    peerId: string
    bridge: string
    topic: string
    key: string
    chainId: number
    accounts: string[]
    handshakeId?: number
    createdAt: number
    peer: WalletConnectV1Connection['peer']
}

type ResolvedSessionFields = {
    bridge: string | null
    topic: string | null
    key: string | null
    clientId: string | null
    peerId: string | null
    chainId: number | null
    accounts: string[]
}

type ValidSessionFields = {
    [K in keyof ResolvedSessionFields]: NonNullable<ResolvedSessionFields[K]>
}

const isSessionValid = (
    fields: ResolvedSessionFields,
): fields is ValidSessionFields =>
    Boolean(
        fields.bridge &&
        fields.topic &&
        fields.key &&
        fields.clientId &&
        fields.peerId &&
        fields.chainId != null &&
        fields.accounts.length > 0,
    )

const toConnection = (
    legacy: LegacyWalletConnectV1Session,
): ReconstructedLegacySession | null => {
    const meta = parseSessionMeta(legacy.sessionMetaJson)
    const fields: ResolvedSessionFields = {
        bridge: meta.bridge,
        topic: meta.topic,
        key: legacy.currentKey ?? meta.key,
        clientId: legacy.clientId,
        peerId: legacy.peerId,
        chainId: legacy.chainId,
        accounts: legacy.approvedAccounts?.length
            ? legacy.approvedAccounts
            : legacy.connectedAccounts,
    }

    if (!isSessionValid(fields)) {
        return null
    }

    const { bridge, topic, key, clientId, peerId, chainId, accounts } = fields

    return {
        clientId,
        peerId,
        bridge,
        topic,
        key,
        chainId,
        accounts,
        // Omitted (not defaulted to 0) when the legacy record has no
        // handshakeId — see `WalletConnectV1Metadata.handshakeId` and
        // `importLegacyConnections.ts`'s `reconstructRecord` for the same
        // convention. The v1 handler's replay guard tests
        // `!== undefined`, so a real, carried id must survive untouched.
        handshakeId:
            typeof legacy.handshakeId === 'number'
                ? legacy.handshakeId
                : undefined,
        createdAt: normalizeTimestampMs(legacy.dateTimestampMs),
        peer: toPeer(legacy.peerMeta),
    }
}

/**
 * Imports v1 sessions exported from the legacy native (iOS/Android) apps
 * directly into the connections model, moving each session key into the
 * keystore behind a `secretRef` — no session key ever reaches the written
 * record. This is the first-run counterpart to
 * `packages/walletconnect/src/migration/importLegacyConnections.ts`, which
 * migrates the RN app's own persisted `wallet-connect-store` blob; the two
 * inputs differ but the records they produce are field-for-field
 * consistent.
 *
 * Only sessions whose every account has already been migrated are imported —
 * a connection authorised for an address the wallet does not yet hold would
 * be unusable and, worse, misleading.
 */
export const migrateWalletConnect = async (
    sessions: LegacyWalletConnectV1Session[],
): Promise<WalletConnectMigrationResult> => {
    const result: WalletConnectMigrationResult = { imported: 0, skipped: 0 }
    if (sessions.length === 0) {
        return result
    }

    const migratedAddresses = new Set(
        useAccountsStore.getState().accounts.map(account => account.address),
    )

    const store = getProvider().connections.store
    const existing = await store.list()
    const seenIds = new Set(existing.map(connection => connection.id))
    const seenTopics = new Set(
        existing
            .filter(isWalletConnectV1Connection)
            .map(connection => connection.metadata.handshakeTopic),
    )

    // A genuine I/O failure (commitSessionKey or store.upsert throwing —
    // storage write failure, quota, serialization) is NOT a deliberate skip
    // and must never be folded into `result.skipped`: this function's only
    // caller (`runExtrasMigration.ts`'s `walletConnect` step) reports success
    // to `runMigration.ts` whenever nothing escapes, which stamps the step
    // complete and permanently excludes it from every future run
    // (`pendingStepsFromVersions`). Swallowing a write failure here would
    // orphan an already-committed session key — `commitSessionKey` can
    // succeed and `store.upsert` can still fail — with no record ever
    // referencing it, and no retry path, ever. So: keep attempting every
    // remaining session (one bad one must not strand the rest), but rethrow
    // once the whole batch is done whenever any attempt genuinely failed.
    let firstFailure: Error | null = null

    for (const session of sessions) {
        const reconstructed = toConnection(session)
        if (
            !reconstructed ||
            seenIds.has(reconstructed.clientId) ||
            seenTopics.has(reconstructed.topic)
        ) {
            result.skipped += 1
            continue
        }
        if (
            !reconstructed.accounts.every(address =>
                migratedAddresses.has(address),
            )
        ) {
            result.skipped += 1
            continue
        }

        try {
            const secretRef = await commitSessionKey(
                reconstructed.clientId,
                reconstructed.key,
            )

            const connection: WalletConnectV1Connection = {
                id: reconstructed.clientId,
                kind: 'walletconnect-v1',
                name: reconstructed.peer.name,
                peer: reconstructed.peer,
                accounts: reconstructed.accounts,
                secretRef,
                status: 'active',
                createdAt: reconstructed.createdAt,
                lastActiveAt: reconstructed.createdAt,
                metadata: {
                    bridge: reconstructed.bridge,
                    handshakeTopic: reconstructed.topic,
                    peerId: reconstructed.peerId,
                    chainId: reconstructed.chainId,
                    ...(reconstructed.handshakeId !== undefined
                        ? { handshakeId: reconstructed.handshakeId }
                        : {}),
                    // The native export carries no per-session method list, so
                    // the settings detail screen would show an empty
                    // permissions panel where a blob-migrated session shows a
                    // full one. `ALL_PERMISSIONS` is the same fallback the v1
                    // handler applies to a handshake that names none, and the
                    // legacy native apps gated no method per session.
                    permissions: [...ALL_PERMISSIONS],
                },
            }
            await store.upsert(connection)

            seenIds.add(reconstructed.clientId)
            seenTopics.add(reconstructed.topic)
            result.imported += 1
        } catch (error) {
            firstFailure ??=
                error instanceof Error ? error : new Error(String(error))
        }
    }

    if (firstFailure) throw firstFailure

    return result
}

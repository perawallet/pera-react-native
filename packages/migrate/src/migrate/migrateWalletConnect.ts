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
import { logger } from '@perawallet/wallet-core-shared'
import type { LegacyWalletConnectV1Session } from '@perawallet/wallet-extension-platform'
import {
    AlgorandChainId,
    PERA_CLIENT_META,
    useWalletConnectStore,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'

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

const parseSessionMeta = (json: string): ParsedSessionMeta | null => {
    try {
        const parsed: unknown = JSON.parse(json)
        if (parsed === null || typeof parsed !== 'object') {
            return null
        }
        const meta = parsed as Record<string, unknown>
        return {
            bridge: typeof meta.bridge === 'string' ? meta.bridge : null,
            key: typeof meta.key === 'string' ? meta.key : null,
            topic: typeof meta.topic === 'string' ? meta.topic : null,
        }
    } catch {
        return null
    }
}

type ImportableConnection = WalletConnectConnection & {
    clientId: string
    session: NonNullable<WalletConnectConnection['session']>
}

/**
 * Why a legacy row did not become a live connection. Every skip is logged
 * with the legacy row's own `id` so a lost session can be traced back to a
 * specific Pera 6 row instead of vanishing into an aggregate count.
 */
type SkipReason =
    | 'unparseable-session-meta'
    | 'missing-bridge'
    | 'missing-topic'
    | 'missing-key'
    | 'missing-client-id'
    | 'missing-peer-id'
    | 'no-accounts'
    | 'duplicate-client-id'
    | 'duplicate-topic'
    | 'unmigrated-accounts'
    | 'unexpected-error'

type ConversionOutcome =
    | { ok: true; connection: ImportableConnection }
    | { ok: false; reason: SkipReason }

const toConnection = (
    legacy: LegacyWalletConnectV1Session,
): ConversionOutcome => {
    const meta = parseSessionMeta(legacy.sessionMetaJson)
    if (!meta) {
        return { ok: false, reason: 'unparseable-session-meta' }
    }

    const { bridge, topic } = meta
    const key = legacy.currentKey ?? meta.key
    const { clientId, peerId } = legacy
    const accounts = legacy.approvedAccounts?.length
        ? legacy.approvedAccounts
        : legacy.connectedAccounts

    // Each of these is required to rehydrate a working WC v1 socket and none
    // can be derived from anything else the legacy row carries.
    if (!bridge) return { ok: false, reason: 'missing-bridge' }
    if (!topic) return { ok: false, reason: 'missing-topic' }
    if (!key) return { ok: false, reason: 'missing-key' }
    if (!clientId) return { ok: false, reason: 'missing-client-id' }
    if (!peerId) return { ok: false, reason: 'missing-peer-id' }
    if (accounts.length === 0) return { ok: false, reason: 'no-accounts' }

    return {
        ok: true,
        connection: {
            clientId,
            version: 1,
            bridge,
            connected: false,
            createdAt: new Date(normalizeTimestampMs(legacy.dateTimestampMs)),
            session: {
                connected: true,
                accounts,
                // Pera 6 did not always record the chain and the legacy
                // export carries no network preference to fall back on. `all`
                // is WC v1's own "any Algorand chain" value, so the session
                // survives — but this IS a real widening: per the
                // `sessionChainId` note in the browser extension's
                // `bindHeadlessHandlers`, the persisted chainId is the
                // anti-spoof ground truth precisely because a dApp can talk
                // the live connector into `all` but not the stored record.
                // Accepted because the alternative is losing the session with
                // no notice, and every signature still needs user approval on
                // a sheet that names the network.
                chainId: legacy.chainId ?? AlgorandChainId.all,
                bridge,
                key,
                clientId,
                clientMeta: PERA_CLIENT_META,
                peerId,
                peerMeta: {
                    name: legacy.peerMeta.name,
                    url: legacy.peerMeta.url,
                    icons: legacy.peerMeta.icons,
                    description: legacy.peerMeta.description,
                },
                handshakeId: legacy.handshakeId ?? 0,
                handshakeTopic: topic,
            },
        },
    }
}

export const migrateWalletConnect = (
    sessions: LegacyWalletConnectV1Session[],
): WalletConnectMigrationResult => {
    const result: WalletConnectMigrationResult = { imported: 0, skipped: 0 }
    if (sessions.length === 0) {
        return result
    }

    const migratedAddresses = new Set(
        useAccountsStore.getState().accounts.map(account => account.address),
    )

    const store = useWalletConnectStore.getState()
    const existing = store.walletConnectConnections
    const seenClientIds = new Set(
        existing.map(connection => connection.clientId).filter(Boolean),
    )
    const seenTopics = new Set(
        existing
            .map(connection => connection.session?.handshakeTopic)
            .filter(Boolean),
    )

    const imports: ImportableConnection[] = []
    const skip = (
        session: LegacyWalletConnectV1Session,
        reason: SkipReason,
        detail?: Record<string, unknown>,
    ): void => {
        result.skipped += 1
        logger.warn('[Migration] walletConnect session skipped', {
            id: session.id,
            dApp: session.peerMeta?.name,
            reason,
            ...detail,
        })
    }

    for (const session of sessions) {
        try {
            const outcome = toConnection(session)
            if (!outcome.ok) {
                skip(session, outcome.reason)
                continue
            }
            const { connection } = outcome
            if (seenClientIds.has(connection.clientId)) {
                skip(session, 'duplicate-client-id')
                continue
            }
            if (seenTopics.has(connection.session.handshakeTopic)) {
                skip(session, 'duplicate-topic')
                continue
            }
            const missingAccounts = connection.session.accounts.filter(
                address => !migratedAddresses.has(address),
            )
            if (missingAccounts.length > 0) {
                skip(session, 'unmigrated-accounts', { missingAccounts })
                continue
            }
            seenClientIds.add(connection.clientId)
            seenTopics.add(connection.session.handshakeTopic)
            imports.push(connection)
            result.imported += 1
        } catch (err) {
            skip(session, 'unexpected-error', { error: err })
        }
    }

    if (imports.length > 0) {
        store.setWalletConnectConnections([...existing, ...imports])
    }
    return result
}

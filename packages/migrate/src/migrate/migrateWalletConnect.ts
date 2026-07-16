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

type ImportableConnection = WalletConnectConnection & {
    clientId: string
    session: NonNullable<WalletConnectConnection['session']>
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
): ImportableConnection | null => {
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
        version: 1,
        bridge,
        connected: false,
        createdAt: new Date(normalizeTimestampMs(legacy.dateTimestampMs)),
        session: {
            connected: true,
            accounts,
            chainId,
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
    for (const session of sessions) {
        try {
            const connection = toConnection(session)
            if (
                !connection ||
                seenClientIds.has(connection.clientId) ||
                seenTopics.has(connection.session.handshakeTopic)
            ) {
                result.skipped += 1
                continue
            }
            if (
                !connection.session.accounts.every(address =>
                    migratedAddresses.has(address),
                )
            ) {
                result.skipped += 1
                continue
            }
            seenClientIds.add(connection.clientId)
            seenTopics.add(connection.session.handshakeTopic)
            imports.push(connection)
            result.imported += 1
        } catch {
            result.skipped += 1
        }
    }

    if (imports.length > 0) {
        store.setWalletConnectConnections([...existing, ...imports])
    }
    return result
}

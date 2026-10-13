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

import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { DAPP_KIND } from './protocol'

export const LEGACY_DAPP_PERMISSIONS_KEY = 'pera-dapp-permissions'

/** The `chrome.storage.local` subset the importer needs. */
export type LegacyDappPermissionArea = {
    get(key: string): Promise<Record<string, unknown>>
    remove(key: string): Promise<void>
}

type LegacyDappPermission = {
    origin: string
    addresses: string[]
    name?: string
    iconUrl?: string
    grantedAt: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isLegacyDappPermission = (
    value: unknown,
): value is LegacyDappPermission =>
    isRecord(value) &&
    typeof value.origin === 'string' &&
    Array.isArray(value.addresses) &&
    value.addresses.every(address => typeof address === 'string') &&
    typeof value.grantedAt === 'number' &&
    (value.name === undefined || typeof value.name === 'string') &&
    (value.iconUrl === undefined || typeof value.iconUrl === 'string')

const hostOf = (origin: string): string => {
    try {
        return new URL(origin).host
    } catch {
        return origin
    }
}

const toConnection = (grant: LegacyDappPermission): Connection => {
    const name = grant.name ?? hostOf(grant.origin)
    return {
        id: grant.origin,
        kind: DAPP_KIND,
        name,
        peer: {
            name,
            url: grant.origin,
            ...(grant.iconUrl ? { icons: [grant.iconUrl] } : {}),
        },
        accounts: grant.addresses,
        status: 'active',
        createdAt: grant.grantedAt,
        lastActiveAt: grant.grantedAt,
    }
}

/**
 * Crash-resumable: upserts as it goes and only deletes the legacy blob once
 * every grant reads back from the store, so a partial pass retries next launch.
 */
export const importLegacyDappPermissions = async ({
    area,
    store,
}: {
    area: LegacyDappPermissionArea
    store: ConnectionStoreAPI
}): Promise<{ imported: number }> => {
    const raw = (await area.get(LEGACY_DAPP_PERMISSIONS_KEY))[
        LEGACY_DAPP_PERMISSIONS_KEY
    ]
    if (!isRecord(raw)) return { imported: 0 }

    const grants = Object.values(raw).filter(isLegacyDappPermission)
    let imported = 0
    for (const grant of grants) {
        if (await store.get(grant.origin)) continue
        await store.upsert(toConnection(grant))
        imported += 1
    }
    for (const grant of grants) {
        if (!(await store.get(grant.origin))) return { imported }
    }

    await area.remove(LEGACY_DAPP_PERMISSIONS_KEY)
    return { imported }
}

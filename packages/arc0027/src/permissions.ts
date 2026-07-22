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

// Per-origin dapp permission model. Origin (SW-observed sender.origin) → the
// wallet account addresses the user consented to share. Stored under one key
// in chrome.storage.local as an origin-keyed map. Pure over an injectable
// storage area so the SW router and the UI read model share one implementation.
export const DAPP_PERMISSIONS_STORAGE_KEY = 'pera-dapp-permissions'

export type DappPermission = {
    origin: string
    addresses: string[]
    name?: string
    iconUrl?: string
    grantedAt: number
}

export type DappPermissionsMap = Record<string, DappPermission>

export interface LocalStorageArea {
    get(keys: string): Promise<Record<string, unknown>>
    set(items: Record<string, unknown>): Promise<void>
}

export class DappPermissionStore {
    private queue: Promise<unknown> = Promise.resolve()

    constructor(
        private readonly area: LocalStorageArea,
        private readonly now: () => number = () => Date.now(),
    ) {}

    private async withLock<T>(fn: () => Promise<T>): Promise<T> {
        if (typeof navigator !== 'undefined' && navigator.locks) {
            return navigator.locks.request('pera-dapp-permissions', fn)
        }
        const next = this.queue.then(fn)
        this.queue = next.catch(() => {})
        return next
    }

    private async readMap(): Promise<DappPermissionsMap> {
        const raw = await this.area.get(DAPP_PERMISSIONS_STORAGE_KEY)
        const value = raw[DAPP_PERMISSIONS_STORAGE_KEY]
        return (value as DappPermissionsMap | undefined) ?? {}
    }

    private async writeMap(map: DappPermissionsMap): Promise<void> {
        await this.area.set({ [DAPP_PERMISSIONS_STORAGE_KEY]: map })
    }

    async list(): Promise<DappPermission[]> {
        const map = await this.readMap()
        return Object.values(map).sort((a, b) => b.grantedAt - a.grantedAt)
    }

    async get(origin: string): Promise<DappPermission | null> {
        const map = await this.readMap()
        return map[origin] ?? null
    }

    async approvedAddresses(origin: string): Promise<string[]> {
        return (await this.get(origin))?.addresses ?? []
    }

    async isConnected(origin: string): Promise<boolean> {
        return (await this.approvedAddresses(origin)).length > 0
    }

    async grant(
        origin: string,
        addresses: string[],
        meta?: { name?: string; iconUrl?: string },
    ): Promise<DappPermission> {
        return this.withLock(async () => {
            const map = await this.readMap()
            const permission: DappPermission = {
                origin,
                addresses: [...addresses],
                name: meta?.name,
                iconUrl: meta?.iconUrl,
                grantedAt: this.now(),
            }
            map[origin] = permission
            await this.writeMap(map)
            return permission
        })
    }

    async revoke(origin: string): Promise<void> {
        return this.withLock(async () => {
            const map = await this.readMap()
            if (!(origin in map)) return
            delete map[origin]
            await this.writeMap(map)
        })
    }

    async pruneAddresses(validAddresses: Set<string>): Promise<void> {
        return this.withLock(async () => {
            const map = await this.readMap()
            let changed = false
            for (const [origin, permission] of Object.entries(map)) {
                const kept = permission.addresses.filter(a =>
                    validAddresses.has(a),
                )
                if (kept.length === permission.addresses.length) continue
                changed = true
                if (kept.length === 0) delete map[origin]
                else map[origin] = { ...permission, addresses: kept }
            }
            if (changed) await this.writeMap(map)
        })
    }
}

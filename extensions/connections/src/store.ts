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
    type Connection,
    type ConnectionId,
    type ConnectionPersistence,
    type ConnectionStoreAPI,
    isConnection,
} from './models'

export const CONNECTIONS_STORAGE_KEY = 'pera.connections.v1'

type Listener = (connections: Connection[]) => void

// Reads validate every record so a malformed row cannot poison the whole list.
export const createConnectionStore = (options: {
    storage: ConnectionPersistence
}): ConnectionStoreAPI => {
    const { storage } = options
    const listeners = new Set<Listener>()

    const read = (): Connection[] => {
        const raw = storage.getItem(CONNECTIONS_STORAGE_KEY)
        if (!raw) return []
        try {
            const parsed: unknown = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.filter(isConnection) : []
        } catch {
            // A corrupt blob reads as empty rather than throwing at startup; the
            // importer's marker is separate, so it will not re-run.
            return []
        }
    }

    const write = (connections: Connection[]): void => {
        storage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections))
        for (const listener of listeners) {
            listener(connections)
        }
    }

    return {
        list: async () => read(),
        get: async (id: ConnectionId) => read().find(c => c.id === id),
        upsert: async (connection: Connection) => {
            write([...read().filter(c => c.id !== connection.id), connection])
        },
        remove: async (id: ConnectionId) => {
            write(read().filter(c => c.id !== id))
        },
        clear: async () => {
            write([])
        },
        subscribe: (listener: Listener) => {
            listeners.add(listener)
            return () => void listeners.delete(listener)
        },
    }
}

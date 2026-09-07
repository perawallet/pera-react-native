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
    commitSecret,
    hasSecret,
    removeSecret,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import type { ConnectionPersistence } from '@perawallet/wallet-extension-connections'

const PREFIX = 'wc1-session-key:'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const sessionKeySecretRef = (clientId: string): string =>
    `${PREFIX}${clientId}`

export interface WalletConnectV1SessionKeyStore {
    /** Idempotent; resolves with the `secretRef` to persist on the record. */
    commit(clientId: string, key: string): Promise<string>
    has(clientId: string): boolean
    read(clientId: string): Promise<string | null>
    remove(clientId: string): Promise<void>
}

/**
 * Keys live as keystore `secret-key` entries. This fixes at-rest exposure
 * only: `session.key` is a hex string the connector retains for the socket's
 * lifetime, and JS strings cannot be zeroed. The encoded buffer here can be,
 * once `commitSecret` has taken its own copy.
 */
export const createKeystoreSessionKeyStore =
    (): WalletConnectV1SessionKeyStore => ({
        commit: async (clientId, key) => {
            const id = sessionKeySecretRef(clientId)
            if (!hasSecret(id)) {
                const bytes = encoder.encode(key)
                try {
                    await commitSecret({ id, bytes })
                } finally {
                    zeroBytes(bytes)
                }
            }
            return id
        },
        has: clientId => hasSecret(sessionKeySecretRef(clientId)),
        read: clientId =>
            withSecret(sessionKeySecretRef(clientId), bytes =>
                decoder.decode(bytes),
            ),
        remove: async clientId => {
            await removeSecret(sessionKeySecretRef(clientId))
        },
    })

// The extension's offscreen document has no vault and revives sockets before
// unlock, so this holds the key in plaintext KV: the posture the legacy blob had.
export const createStorageSessionKeyStore = (
    storage: ConnectionPersistence,
): WalletConnectV1SessionKeyStore => ({
    commit: async (clientId, key) => {
        const id = sessionKeySecretRef(clientId)
        if (storage.getItem(id) === null) storage.setItem(id, key)
        return id
    },
    has: clientId => storage.getItem(sessionKeySecretRef(clientId)) !== null,
    read: async clientId => storage.getItem(sessionKeySecretRef(clientId)),
    remove: async clientId => {
        storage.removeItem(sessionKeySecretRef(clientId))
        storage.trim?.()
    },
})

export const commitSessionKey = (
    clientId: string,
    key: string,
): Promise<string> => createKeystoreSessionKeyStore().commit(clientId, key)

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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { zeroBytes } from '../crypto/secure-memory'
import { KeyManagementError } from '../errors'

/** `secrets` is optional on the KeyStore contract, so a backend may omit it. */
const secretStore = () => {
    const { secrets } = getProvider().key.store
    if (!secrets) {
        throw new KeyManagementError(
            'Keystore backend does not implement secrets',
        )
    }
    return secrets
}

/**
 * Stores an arbitrary byte payload in the keystore as a canonical
 * `secret-key` entry. Used for PIN records, biometric blobs, and any other
 * Pera-domain secret that doesn't fit the seed/derived-key flow.
 */
export const commitSecret = async (params: {
    id: string
    bytes: Uint8Array
    metadata?: Record<string, unknown>
}): Promise<void> => {
    const valueCopy = new Uint8Array(params.bytes)
    try {
        // NOT `generate`: its type router has no `secret-key` branch, so the
        // call falls through to the host key path and dies on `algorithm:
        // 'raw'` with "Unrecognized algorithm name".
        await secretStore().put(valueCopy, {
            id: params.id,
            ...(params.metadata !== undefined
                ? { metadata: params.metadata }
                : {}),
        })
    } finally {
        zeroBytes(valueCopy)
    }

    const store = getKeystoreStore()
    const seen = new Set<string>()
    const deduped = store.state.keys.filter(k => {
        if (seen.has(k.id)) return false
        seen.add(k.id)
        return true
    })
    if (deduped.length !== store.state.keys.length) {
        store.setState(s => ({ ...s, keys: deduped }))
    }
}

/**
 * Synchronous existence check via the reactive store.
 */
export const hasSecret = (id: string): boolean => {
    return getKeystoreStore().state.keys.some(k => k.id === id)
}

/**
 * Runs `handler` with the decrypted secret bytes for `id`, then zeroes them
 * in `finally`. The secret never leaves this scope as a returned value, so
 * callers can't accidentally retain sensitive material beyond the handler's
 * lifetime. Returns `null` (without invoking `handler`) when the secret
 * doesn't exist. Mirrors the read side of `commitSecret`.
 */
export const withSecret = async <T>(
    id: string,
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => {
    if (!hasSecret(id)) return null
    // Secrets are the one entry kind meant to be read back, and `secrets.get`
    // is that channel: `export` returns public metadata only, so reading a
    // secret through it silently yields nothing.
    const bytes = await secretStore().get(id)
    if (!bytes) return null
    try {
        return await handler(bytes)
    } finally {
        zeroBytes(bytes)
    }
}

/**
 * Removes a secret if present. No-op (no throw) when the id isn't there, so
 * callers can use this freely as a "delete-if-exists" without catching.
 */
export const removeSecret = async (id: string): Promise<void> => {
    if (!hasSecret(id)) return
    try {
        await getProvider().key.store.remove(id)
    } catch {
        // Tolerate not-found races between the hasSecret check and the
        // remove call (or any other source of `KeyNotFoundError`).
    }
}

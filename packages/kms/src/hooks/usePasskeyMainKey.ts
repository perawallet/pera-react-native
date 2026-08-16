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

import type { Key, KeyId } from '@algorandfoundation/keystore-core'
import {
    getKeystoreStore,
    PASSKEY_MAIN_KEY_SCHEME,
    passkeyMainKeyId,
} from '@perawallet/wallet-extension-provider'
import { entropyChildIdOf } from '../utils'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'

// Shared with `repairs/0003-mint-passkey-main-key`, which back-fills the same
// key for wallets that predate this hook.
export { PASSKEY_MAIN_KEY_SCHEME, passkeyMainKeyId }

const isPasskeyMainKey = (key: Key): boolean =>
    key.type === 'hd-root-key' &&
    (key.metadata as { scheme?: unknown } | undefined)?.scheme ===
        PASSKEY_MAIN_KEY_SCHEME

/**
 * The device's passkey main key, or `null`. Not scoped to a seed: the native
 * credential providers pick the first `pbkdf2-p256` root they find
 * (`selectParentKey`, `PasskeyCredentialStore.swift:99`), so a second one would
 * be ambiguous rather than additive.
 */
export const findPasskeyMainKey = (): Key | null =>
    getKeystoreStore().state.keys.find(isPasskeyMainKey) ?? null

export type UsePasskeyMainKeyResult = {
    ensurePasskeyMainKey: (seedKeyId: KeyId) => Promise<KeyId>
}

export const usePasskeyMainKey = (): UsePasskeyMainKeyResult => {
    const { keyStore } = useKMSService()

    const ensurePasskeyMainKey = async (seedKeyId: KeyId): Promise<KeyId> => {
        const existing = findPasskeyMainKey()
        if (existing) return existing.id

        // The BIP39 entropy child, never the XHD root: `generateDP256Main`
        // PBKDF2s the parent's stored bytes as-is, and the 96-byte extended
        // root is not what the passkey hierarchy is defined against.
        const entropyChildId = entropyChildIdOf(
            seedKeyId,
            getKeystoreStore().state.keys,
        )
        if (!entropyChildId) {
            throw new KeyManagementError(
                `Seed ${seedKeyId} has no entropy child to derive a passkey main key from`,
            )
        }

        return keyStore.generate({
            // `algorithm: 'P256'` is what routes this to `generateDP256Main`
            // rather than the XHD `generateHDRoot` — both are `hd-root-key`.
            type: 'hd-root-key',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['deriveBits', 'deriveKey'],
            params: {
                parentKeyId: entropyChildId,
                id: passkeyMainKeyId(seedKeyId),
            },
        })
    }

    return { ensurePasskeyMainKey }
}

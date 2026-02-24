/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    decodeFromBase64,
    encodeToBase64,
    ERROR_I18N_KEYS,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'
import { KeyPair, KeyType, StoredKeyMaterial } from './models'
import { KeyManagementError } from './errors'
import { KeyData } from '@algorandfoundation/keystore'

export const getSeedFromMasterKey = (
    storedKey: StoredKeyMaterial,
): Uint8Array => {
    try {
        return decodeFromBase64(storedKey.seed)
    } catch (e) {
        throw new KeyManagementError(ERROR_I18N_KEYS.INVALID_KEY, e as Error)
    }
}

export const getEntropyFromMasterKey = (
    storedKey: StoredKeyMaterial,
): Uint8Array | null => {
    try {
        return storedKey.entropy ? decodeFromBase64(storedKey.entropy) : null
    } catch (e) {
        throw new KeyManagementError(ERROR_I18N_KEYS.INVALID_KEY, e as Error)
    }
}

export const makeKeyPair = (source: Partial<KeyPair>): KeyPair => {
    return {
        id: source.id ?? '',
        publicKey: source.publicKey ?? '',
        privateDataStorageKey: source.privateDataStorageKey ?? '',
        type: source.type ?? 'unknown',
        createdAt: source.createdAt ?? new Date(),
        expiresAt: source.expiresAt,
        acl: source.acl ?? [],
    }
}

export function getStorageLocation(
    key: Pick<KeyPair, 'publicKey' | 'id' | 'type'>,
) {
    return key.id ?? generateOrderedUniqueId()
}
export function keyToKeyPair(key: KeyData): KeyPair {
    if (typeof key.privateKey === 'undefined')
        throw new Error('Must have private key')
    switch (key.type) {
        case 'seed':
            return {
                id: key.id,
                publicKey: key.publicKey ? encodeToBase64(key.publicKey) : '',
                privateDataStorageKey: key.id,
                type: KeyType.Algo25Key,
            }
        case 'hd-root-key':
            return {
                id: key.id,
                publicKey: key.publicKey ? encodeToBase64(key.publicKey) : '',
                privateDataStorageKey: key.id,
                type: KeyType.HDWalletRootKey,
            }
        default:
            throw new Error('Unsupported key type for mapping')
    }
}

export function keyPairToKey(
    keyPair: KeyPair,
    privateKey: Uint8Array<ArrayBufferLike>,
): KeyData {
    switch (keyPair.type) {
        case KeyType.Algo25Key:
            return {
                id: keyPair.id as string,
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey,
            }
        case KeyType.HDWalletRootKey:
        case KeyType.DeterministicP256Key:
            return {
                id: keyPair.id as string,
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                privateKey,
            }
        default:
            throw new Error('Unsupported key pair type for mapping')
    }
}

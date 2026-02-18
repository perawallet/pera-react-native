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
    ERROR_I18N_KEYS,
} from '@perawallet/wallet-core-shared'
import { AppError, logger } from '@perawallet/wallet-core-shared'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { AccessControlPermission, KeyPair, StoredKeyMaterial } from './models'
import { useKeyManagerStore } from './store'
import { v7 as uuid } from 'uuid'
import { KeyAccessError, KeyManagementError } from './errors'

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

export const saveKey = async (key: KeyPair, keyData: StoredKeyMaterial) => {
    const storageKey = key.id ?? uuid()
    const secureStorage = useSecureStorageService()
    const addKey = useKeyManagerStore(state => state.addKey)

    const stringifiedObj = JSON.stringify(keyData)

    key.id = storageKey
    key.privateDataStorageKey = key.publicKey.length
        ? `${key.type}-${key.publicKey}`
        : `${key.type}-${storageKey}`
    key.createdAt = new Date()
    logger.debug('Creating key', key)
    await secureStorage.setItem(
        key.privateDataStorageKey,
        new TextEncoder().encode(stringifiedObj),
    )
    addKey(key)

    return key
}

export const deleteKey = async (id: string) => {
    const getKey = useKeyManagerStore(state => state.getKey)

    const key = getKey(id)
    if (!key) {
        return
    }

    if (key.privateDataStorageKey) {
        const secureStorage = useSecureStorageService()
        await secureStorage.removeItem(key.privateDataStorageKey)
    }
    logger.debug('Deleting key', key)
    const removeKey = useKeyManagerStore(state => state.removeKey)
    removeKey(id)
}

export const executeWithKey = async <T>(
    key: KeyPair,
    domain: string,
    handler: (privateKey: StoredKeyMaterial) => Promise<T>,
) => {
    const secureStorage = useSecureStorageService()

    if (key.acl?.length) {
        const hasAccess = key.acl.some(
            acl =>
                acl.domains.includes(domain) &&
                acl.permissions.includes(AccessControlPermission.ReadPrivate),
        )

        if (!hasAccess) {
            throw new KeyAccessError()
        }
    }

    if (!key.privateDataStorageKey) {
        throw new KeyAccessError()
    }

    const privateKey = await secureStorage.getItem(key.privateDataStorageKey)

    if (!privateKey) {
        throw new KeyAccessError()
    }

    try {
        const storedKey: StoredKeyMaterial = JSON.parse(
            new TextDecoder().decode(privateKey),
        )
        const result = await handler(storedKey)

        return result
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }
        throw new KeyAccessError(error as Error)
    } finally {
        //blank out the memory again after using
        if (privateKey) {
            privateKey.fill(0)
        }
    }
}

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

import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { useKeyManagerStore } from '../store'
import { KeyPair } from '../models'
import { v7 as uuidv7 } from 'uuid'
import { useCallback } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { useWithKey } from './useWithKey'
import { getSeedFromMasterKey } from '../utils'

export const useKMS = () => {
    const keys = useKeyManagerStore(state => state.keys)
    const addKey = useKeyManagerStore(state => state.addKey)
    const removeKey = useKeyManagerStore(state => state.removeKey)
    const getKey = useKeyManagerStore(state => state.getKey)
    const secureStorage = useSecureStorageService()

    /**
     * Store a key in the key manager store.
     *
     * @param key the metadata about the key
     * @param privateKeyData base64 encoded private key data
     */
    const saveKey = useCallback(
        async (key: KeyPair, privateKeyData: Uint8Array) => {
            const storageKey = key.id ?? uuidv7()
            key.id = storageKey
            key.privateDataStorageKey = key.publicKey.length
                ? `${key.type}-${key.publicKey}`
                : `${key.type}-${storageKey}`
            key.createdAt = new Date()
            logger.debug('Creating key', key)
            await secureStorage.setItem(
                key.privateDataStorageKey,
                privateKeyData,
            )
            addKey(key)

            return key
        },
        [addKey, secureStorage],
    )

    const deleteKey = useCallback(
        async (id: string) => {
            const key = getKey(id)
            if (!key) {
                return
            }

            if (key.privateDataStorageKey) {
                await secureStorage.removeItem(key.privateDataStorageKey)
            }
            logger.debug('Deleting key', key)
            removeKey(id)
        },
        [getKey, removeKey, secureStorage],
    )

    const { executeWithKey } = useWithKey()

    const executeWithSeed = useCallback(
        async <T>(
            id: string,
            domain: string,
            handler: (seed: Uint8Array) => Promise<T>,
        ) => {
            return executeWithKey(id, domain, async privateData => {
                const seed = getSeedFromMasterKey(privateData)
                return handler(seed)
            })
        },
        [executeWithKey],
    )

    return {
        keys,
        deleteKey,
        saveKey,
        getKey,
        executeWithKey,
        executeWithSeed,
    }
}

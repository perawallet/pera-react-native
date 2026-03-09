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

import type { KeyStoreAPI, KeyData, KeyId } from '@algorandfoundation/keystore'
import { clearKeyData } from '@algorandfoundation/keystore'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useKeyManagerStore } from '../store'
import { AccessControlPermission, KeyPair } from '../models'
import { KeyAccessError } from '../errors'
import { useCallback } from 'react'

export const checkAccess = (key: KeyPair, domain: string): void => {
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
}

type WithExportedKey = <T>(
    keyId: KeyId,
    handler: (keyData: KeyData) => T | Promise<T>,
) => Promise<T>

type UseKMSServiceResult = {
    deleteKey: (id: string) => Promise<void>
    saveKey: (key: KeyPair) => Promise<KeyPair>
    checkAccess: typeof checkAccess
    keyStore: KeyStoreAPI
    withExportedKey: WithExportedKey
}

export const useKMSService = (): UseKMSServiceResult => {
    const keyStore = getProvider().key.store
    const addKey = useKeyManagerStore(state => state.addKey)
    const getKey = useKeyManagerStore(state => state.getKey)
    const removeKey = useKeyManagerStore(state => state.removeKey)

    const saveKey = useCallback(
        async (key: KeyPair) => {
            addKey(key)
            return key
        },
        [addKey],
    )

    const deleteKey = useCallback(
        async (id: string) => {
            const key = getKey(id)
            if (!key) {
                return
            }

            if (key.keystoreKeyId) {
                await keyStore.remove(key.keystoreKeyId)
            }

            removeKey(id)
        },
        [getKey, removeKey, keyStore],
    )

    const withExportedKey: WithExportedKey = async (keyId, handler) => {
        const keyData = await keyStore.export(keyId)
        try {
            return await handler(keyData)
        } finally {
            clearKeyData(keyData)
        }
    }

    return {
        deleteKey,
        saveKey,
        checkAccess,
        keyStore,
        withExportedKey,
    }
}

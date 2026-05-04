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
    checkAccess: typeof checkAccess
    keyStore: KeyStoreAPI
    withExportedKey: WithExportedKey
}

export const useKMSService = (): UseKMSServiceResult => {
    const keyStore = getProvider().key.store

    // The keystore is the single source of truth — `keyStore.remove` mutates
    // the reactive store that `useKeystoreKeys` subscribes to, so React
    // consumers re-render automatically.
    const deleteKey = useCallback(
        async (id: string) => {
            await keyStore.remove(id)
        },
        [keyStore],
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
        checkAccess,
        keyStore,
        withExportedKey,
    }
}

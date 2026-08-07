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

import type {
    Key,
    KeyStoreAPI,
    KeyData,
    KeyId,
} from '@algorandfoundation/keystore-core'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { zeroBytes } from '../crypto/secure-memory'
import { AccessControlPermission } from '../models'
import { aclOf } from '../utils'
import { KeyAccessError } from '../errors'
import { useCallback } from 'react'
import {
    commitSecret,
    hasSecret,
    removeSecret,
    withSecret,
} from '../storage/secrets'
import { type Nullable } from '@perawallet/wallet-core-shared'

export const checkAccess = (key: Key, domain: string): void => {
    // `aclOf` always returns a non-empty ACL (the wallet's own-origin default
    // for seeds without an explicit one), so this is fail-closed: a domain not
    // granted ReadPrivate is rejected rather than slipping through the old
    // empty-ACL bypass.
    const acl = aclOf(key)
    const hasAccess = acl.some(
        entry =>
            entry.domains.includes(domain) &&
            entry.permissions.includes(AccessControlPermission.ReadPrivate),
    )

    if (!hasAccess) {
        throw new KeyAccessError()
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
    commitSecret: typeof commitSecret
    withSecret: <T>(
        id: string,
        handler: (bytes: Uint8Array) => T | Promise<T>,
    ) => Promise<Nullable<T>>
    hasSecret: (id: string) => boolean
    removeSecret: (id: string) => Promise<void>
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
            // The keystore no longer exports a scrubber, so wipe the exported
            // material here — `keyData` is a detached copy the engine will not
            // clean up for us.
            zeroBytes(keyData.privateKey)
            delete keyData.privateKey
        }
    }

    return {
        deleteKey,
        checkAccess,
        keyStore,
        withExportedKey,
        commitSecret,
        withSecret,
        hasSecret,
        removeSecret,
    }
}
